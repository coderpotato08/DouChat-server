import { ChatCompletionFunctionTool } from "openai/resources";
import z from "zod";
import { SystemLogger } from "../../console";
import { askUserForPermission, checkCommandPermissionRules } from "../permission";
import {
  AgentHookCallback,
  AgentHookEventName,
  PostToolUseHookContext,
  PreToolUseHookContext,
} from "../types/agent";
import { ToolExecutionResponse } from "../types/tools";
import { AgentContext } from "./agent-context";
import { HookManager } from "./hook-manager";

export const DEFAULT_ALLOW_TOOLS = [
  "safe_path",
  "run_bash",
  "run_read",
  "run_write",
  "task_create",
  "task_get",
  "task_list",
  "task_update",
];

type RegisteredToolConfig = {
  name: string;
  description: string;
  parameters: Record<string, z.ZodType>;
};
export type RegisteredTool = RegisteredToolConfig & {
  execute: (args: Record<string, any>, context: AgentContext) => Promise<any>;
};

type InnerRegisteredTool = RegisteredToolConfig & {
  execute: (args: Record<string, any>, context: AgentContext) => Promise<any>;
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

  constructor(hookManager: HookManager) {
    this.tools = new Map();
    this.hookManager = hookManager;
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
    context: AgentContext,
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
      const rawParsedArgs: unknown = rawArgs ? JSON.parse(rawArgs) : {};
      const parsedArgs = z.object(tool.parameters as z.ZodRawShape).parse(rawParsedArgs);
      const eventHandler = context.eventHandler;

      const preToolUseContext: PreToolUseHookContext = {
        requestId: context.requestId,
        userId: context.userId,
        modelProvider: context.modelProvider,
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

      await eventHandler?.onToolUseStart?.(toolName, toolCallId, parsedArgs);
      SystemLogger.agent().toolStart({ toolName, toolCallId, input: rawArgs }).printLog();
      const toolResult = await tool.execute(parsedArgs, context);
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
      await eventHandler?.onToolUseDone?.(toolName, toolCallId, true, successResult.output);
      const postToolUseContext: PostToolUseHookContext = {
        requestId: context.requestId,
        userId: context.userId,
        modelProvider: context.modelProvider,
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
      const eventHandler = context.eventHandler;
      await eventHandler?.onToolUseDone?.(toolName, toolCallId, false, { error: output });
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
