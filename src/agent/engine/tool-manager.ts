import z from "zod";
import { ToolExecutionResponse } from "../types/tools";
import { ChatCompletionFunctionTool } from "openai/resources";

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

  constructor() {
    this.tools = new Map();
  }

  public async executeToolHandler(
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
      const toolResult = await tool.execute(rawArgs ? JSON.parse(rawArgs) : {});
      return Promise.resolve({
        toolName,
        success: true,
        output: toolResult,
        executionTime: Date.now() - startTime, // 可以根据实际情况计算执行时间
      });
    } catch (error: any) {
      console.log(`❗️工具 "${toolName}" 执行失败:`, error);
      return Promise.resolve({
        toolName,
        success: false,
        error: `Tool execution failed: ${error.message}`,
        executionTime: 0,
      });
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
