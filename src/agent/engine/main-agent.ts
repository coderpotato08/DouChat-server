import OpenAI from "openai";
import { ChatCompletionFunctionTool, ChatCompletionToolChoiceOption } from "openai/resources";
import { registerBaseTools } from "../tools/baseTools";
import { ChatCompletionBaseParams, EnvConfig, EventHandler, SYSTEM_PROMPT } from "../types/agent";
import { ToolManager } from "./tool-manager";

let mainAgentInstance: MainAgent | null = null;

export function initMainAgent(): MainAgent {
  if (!mainAgentInstance) {
    mainAgentInstance = new MainAgent();
  }
  return mainAgentInstance;
}
export class MainAgent {
  // openai 实例
  private agentClient: OpenAI;
  // openai 相关配置
  private agentConfig: EnvConfig["openAI"]; // 可以根据需要定义更具体的类型
  private toolManager: ToolManager;
  constructor() {
    this.toolManager = new ToolManager();
    // const env = {
    //   baseUrl: process.env.OPENAI_BASE_URL as string,
    //   apiKey: process.env.OPENAI_API_KEY as string,
    //   model: process.env.OPENAI_MODEL as string,
    // };
    const env = {
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKey: "sk-f13366e145504bcb84b2df2c256c73a7",
      model: "qwen3.5-35b-a3b",
    };

    this.agentConfig = env;
    this.agentClient = new OpenAI({
      baseURL: this.agentConfig.baseUrl,
      apiKey: this.agentConfig.apiKey,
    });
    // 初始化工具
    try {
      this.toolManager.registerTools([...registerBaseTools()]);
    } catch (error) {
      console.error("❗️工具初始化失败:", error);
    }
  }

  public buildCompletionOptions() {
    const { baseUrl, apiKey, model } = this.agentConfig;
    if (!baseUrl || !apiKey || !model) {
      throw new Error("OpenAI configuration is incomplete. Please check your environment variables.");
    }
    // 获取工具配置
    const toolsConfigs: ChatCompletionFunctionTool[] = this.toolManager.getToolsConfig();

    return {
      model,
      tool_choice: "auto" as ChatCompletionToolChoiceOption,
      tools: toolsConfigs,
    };
  }

  public async sendStreamMessage(userId: string, message: string, streamHandler?: EventHandler) {
    const messageList: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
    ];
    const baseConfig: ChatCompletionBaseParams = {
      ...this.buildCompletionOptions(),
    };
    const maxToolRounds = 20;
    messageList.push({
      role: "user",
      content: message,
    });
    // agent looping 
    for (let round = 0; round < maxToolRounds; round++) {
      // 调用 openai api
      try {
        const completion = await this.agentClient.chat.completions.create({
          ...baseConfig,
          stream: false,
          messages: messageList,
        });
        const assistantResponse = completion?.choices[0];
        const { message, finish_reason } = assistantResponse;
        const toolCalls = message?.tool_calls || [];
        messageList.push(message);
        if (finish_reason === "stop") {
          break;
        }
        for (const tool of toolCalls) {
          if (tool.type !== "function") {
            continue;
          }
          const toolResult = await this.toolManager.executeToolHandler(
            tool.function.name,
            tool.function.arguments
          );
          messageList.push({
            role: "tool",
            tool_call_id: tool.id,
            content: JSON.stringify(toolResult.output),
          });
        }
      } catch (error) {}
    }
  }
}
