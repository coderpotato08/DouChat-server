import { ChatCompletionFunctionTool } from "openai/resources";
import z from "zod";
import { SystemLogger } from "../../console";
import { askUserForPermission, checkCommandPermissionRules } from "../tools/premission";
import { EventHandler } from "../types/agent";
import { ToolExecutionResponse } from "../types/tools";

export const DEFAULT_ALLOW_TOOLS = [
  "get_message_records",
  "search_friends_markdown",
  "safe_path",
  "run_bash",
  "run_read",
  "run_write",
  "todo",
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
  private eventHandler: EventHandler | undefined;

  constructor() {
    this.tools = new Map();
  }

  public setEventHandler(handler: EventHandler): void {
    this.eventHandler = handler;
  }

  public async executeToolHandler(
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
      SystemLogger.agent()
        .toolStart({
          toolName,
          toolCallId,
          input: rawArgs,
        })
        .printLog();
      const parsedArgs = rawArgs ? JSON.parse(rawArgs) : {};

      // gate 2: 规则匹配
      const permissionMessage = checkCommandPermissionRules(toolName, parsedArgs);
      if (permissionMessage) {
        // gate 3: 暂停等待用户决策
        const allowed = await askUserForPermission(permissionMessage, this.eventHandler);
        if (!allowed) {
          const deniedResult: ToolExecutionResponse = {
            toolName,
            success: false,
            error: `PermissionDenied: user rejected the tool call for "${toolName}"`,
            executionTime: Date.now() - startTime,
          };
          SystemLogger.agent()
            .toolDone({ toolCallId, ...deniedResult })
            .printLog();
          return deniedResult;
        }
      }

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
      return Promise.resolve(successResult);
    } catch (error: any) {
      const errorResult = {
        toolName,
        success: false,
        error: `Tool execution failed: ${error.message}`,
        executionTime: 0,
      };
      SystemLogger.agent()
        .toolDone({
          toolCallId,
          ...errorResult,
        })
        .printLog();
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
