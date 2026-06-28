import { ChatCompletionFunctionTool } from "openai/resources";
import z from "zod";
import { SystemLogger } from "../../console";
import { StreamHandler } from "../handlers/stream-handler";
import { askUserForPermission, checkCommandPermissionRules } from "../permission";
import {
  AgentHookCallback,
  AgentHookEventName,
  PostToolUseHookContext,
  PreToolUseHookContext,
} from "../types/agent";
import { ToolExecutionResponse } from "../types/tools";
import { HookManager } from "./hook-manager";

export const DEFAULT_ALLOW_TOOLS = [
  "safe_path",
  "run_bash",
  "run_read",
  "run_write",
  "todo",
  // "task_create",
  // "task_get",
  // "task_list",
  // "task_update",
];

type RegisteredToolConfig = {
  name: string;
  description: string;
  parameters: Record<string, z.ZodType>;
};
export type RegisteredTool = RegisteredToolConfig & {
  execute: (args: Record<string, any>) => Promise<any>;
};

type InnerRegisteredTool = RegisteredToolConfig & {
  execute: (args: Record<string, any>) => Promise<ToolExecutionResponse>;
};
function toFunctionParameters(
  parameters: Record<string, z.ZodType>,
): ChatCompletionFunctionTool["function"]["parameters"] {
  return z
    .object(parameters as z.ZodRawShape)
    .toJSONSchema() as ChatCompletionFunctionTool["function"]["parameters"];
}

export class ToolManager {
  private tools: Map<string, InnerRegisteredTool>;
  private readonly hookManager: HookManager;
  private readonly streamHandler: StreamHandler;

  constructor(hookManager: HookManager, streamHandler: StreamHandler) {
    this.tools = new Map();
    this.hookManager = hookManager;
    this.streamHandler = streamHandler;
    this.registerHooks("PreToolUse", async (context) => {
      const permissionMessage = checkCommandPermissionRules(context.toolName, context.parsedArgs);
      if (!permissionMessage) {
        return;
      }

      const allowed = await context.requestPermission?.(permissionMessage);
      if (!allowed) {
        return {
          block: true,
          reason: `PermissionDenied: user rejected the tool call for "${context.toolName}"`,
        };
      }
    });
  }

  public registerHooks<TEventName extends AgentHookEventName>(
    event: TEventName,
    callback: AgentHookCallback<TEventName>,
  ): void {
    this.hookManager.registerHooks(event, callback);
  }

  public async executeToolHandler(
    requestId: string,
    userId: string,
    modelProvider: PreToolUseHookContext["modelProvider"],
    toolCallId: string,
    toolName: string,
    rawArgs: string | undefined,
  ): Promise<ToolExecutionResponse> {
    const tool = this.tools.get(toolName);
    const startTime = Date.now();
    if (!tool) {
      console.error(`❗️工具 "${toolName}" 未注册。`);
      return Promise.resolve({
        toolName,
        success: false,
        error: `Unsupported tool: ${toolName}`,
        executionTime: 0,
      });
    }

    try {
      const parsedArgs = rawArgs ? JSON.parse(rawArgs) : {};
      const eventHandler = this.streamHandler.getEventHandler();

      const preToolUseContext: PreToolUseHookContext = {
        requestId,
        userId,
        modelProvider,
        toolCallId,
        toolName,
        rawArgs,
        parsedArgs,
        requestPermission: async (message: string) => askUserForPermission(message, eventHandler),
      };
      const preToolUseResult = await this.hookManager.triggerHooks("PreToolUse", preToolUseContext);
      if (preToolUseResult?.block) {
        const blockReason = preToolUseResult.reason || `Tool call blocked by PreToolUse hook: ${toolName}`;
        const deniedResult: ToolExecutionResponse = {
          toolName,
          success: false,
          error: blockReason,
          output: blockReason,
          executionTime: Date.now() - startTime,
        };
        SystemLogger.agent()
          .toolDone({
            toolCallId,
            ...deniedResult,
          })
          .printLog();
        return deniedResult;
      }

      await eventHandler?.onToolUseStart?.(toolName, toolCallId, rawArgs);
      SystemLogger.agent().toolStart({ toolName, toolCallId, input: rawArgs }).printLog();
      const toolResult = await tool.execute(parsedArgs);
      const executionTime = Date.now() - startTime;
      const successResult = {
        toolName,
        success: true,
        output: toolResult,
        executionTime,
      };
      SystemLogger.agent()
        .toolDone({
          toolCallId,
          ...successResult,
        })
        .printLog();
      await eventHandler?.onToolUseDone?.(toolName, toolCallId, JSON.stringify(successResult.output));
      const postToolUseContext: PostToolUseHookContext = {
        requestId,
        userId,
        modelProvider,
        toolCallId,
        toolName,
        rawArgs,
        parsedArgs,
        toolResult: successResult,
      };
      await this.hookManager.triggerHooks("PostToolUse", postToolUseContext);
      return Promise.resolve(successResult);
    } catch (error: any) {
      const output = `❗️工具执行失败: ${error.message}`;
      const errorResult = {
        toolName,
        success: false,
        output,
        error: output,
        executionTime: 0,
      };
      SystemLogger.agent()
        .toolDone({
          toolCallId,
          ...errorResult,
        })
        .printLog();
      const eventHandler = this.streamHandler.getEventHandler();
      await eventHandler?.onToolUseDone?.(toolName, toolCallId, output);
      return Promise.resolve(errorResult);
    }
  }

  public registerTool(tool: RegisteredTool) {
    if (this.tools.has(tool.name)) {
      throw new Error(`⚠️工具 "${tool.name}" 已经注册。`);
    }
    this.tools.set(tool.name, {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      execute: tool.execute,
    });
  }

  public registerTools(tools: RegisteredTool[]) {
    return tools.map((tool) => this.registerTool(tool));
  }

  public getToolsConfig(): ChatCompletionFunctionTool[] {
    return Array.from(this.tools.values()).map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: toFunctionParameters(tool.parameters),
      },
    }));
  }
}
