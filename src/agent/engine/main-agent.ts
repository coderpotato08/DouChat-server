import OpenAI from "openai";
import { ChatCompletionFunctionTool, ChatCompletionToolChoiceOption } from "openai/resources";
import { StreamHandler } from "../handlers/stream-handler";
import { buildBashBlacklistSystemPrompt } from "../permission";
import { registerBaseTools } from "../tools/baseTools";
import { registerTodoTools } from "../tools/TodoManager/index";
import {
  ChatCompletionBaseParams,
  EnvConfig,
  EventHandler,
  FINAL_MESSAGE,
  LlmProviderName,
  SYSTEM_PROMPT,
} from "../types/agent";
import { LlmService } from "./llm-service";
import { ToolManager } from "./tool-manager";

let mainAgentInstance: MainAgent | null = null;

export function initMainAgent(): MainAgent {
  if (!mainAgentInstance) {
    mainAgentInstance = new MainAgent();
  }
  return mainAgentInstance;
}

export function getMainAgent(): MainAgent {
  if (!mainAgentInstance) {
    throw new Error("MainAgent has not been initialized. Please call initMainAgent() first.");
  }
  return mainAgentInstance;
}
export class MainAgent {
  private llmService: LlmService;
  private toolManager: ToolManager;
  private streamHandler: StreamHandler;

  constructor() {
    this.toolManager = new ToolManager();
    this.streamHandler = new StreamHandler();
    this.llmService = new LlmService();
    // 初始化工具
    try {
      this.toolManager.registerTools([...registerBaseTools(), ...registerTodoTools()]);
    } catch (error) {
      console.error("❗️工具初始化失败:", error);
    }
  }

  public buildCompletionOptions(agentConfig: EnvConfig["openAI"]) {
    const { baseUrl, apiKey, model } = agentConfig;
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

  public async sendThinkingStreamMessage(
    requestId: string,
    userId: string,
    message: string,
    llmProvider: LlmProviderName,
    streamHandler?: EventHandler,
  ) {
    const { client: agentClient, config: agentConfig } = this.llmService.getClientBundle(llmProvider);
    let reachedNoToolRound = false;
    streamHandler?.onContentStart?.();
    const messageList: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\n\n${buildBashBlacklistSystemPrompt(requestId)}`,
      },
    ];
    const baseConfig: ChatCompletionBaseParams = {
      ...this.buildCompletionOptions(agentConfig),
    };
    const maxToolRounds = 20;
    messageList.push({
      role: "user",
      content: message,
    });
    // agent looping
    if (streamHandler) {
      this.toolManager.setEventHandler(streamHandler);
    }
    streamHandler?.onThinkingStart?.();
    for (let round = 0; round < maxToolRounds; round++) {
      // 调用 openai api
      try {
        const completion = await agentClient.chat.completions.create({
          ...baseConfig,
          stream: false,
          messages: messageList,
        });
        const assistantResponse = completion?.choices[0];
        const { message, finish_reason } = assistantResponse;
        const toolCalls = message?.tool_calls || [];
        messageList.push(message);
        if (finish_reason === "stop") {
          reachedNoToolRound = true;
          break;
        }
        for (const tool of toolCalls) {
          if (tool.type !== "function") {
            continue;
          }
          streamHandler?.onToolUseStart?.(tool.function.name, tool.id, tool.function.arguments);
          const toolResult = await this.toolManager.executeToolHandler(
            tool.id,
            tool.function.name,
            tool.function.arguments,
          );
          const outputStr = JSON.stringify(toolResult.output);
          streamHandler?.onToolUseDone?.(tool.function.name, tool.id, outputStr);
          messageList.push({
            role: "tool",
            tool_call_id: tool.id,
            content: outputStr,
          });
        }
      } catch (error) {
        streamHandler?.onError?.(error as Error);
        throw error;
      }
    }

    if (!reachedNoToolRound) {
      // 达到最大工具调用轮次
    }
    streamHandler?.onThinkingDone?.();

    messageList.push({
      role: "user",
      content: FINAL_MESSAGE,
    });

    let stream: Awaited<ReturnType<typeof agentClient.chat.completions.create>>;
    try {
      stream = await agentClient.chat.completions.create({
        ...this.buildCompletionOptions(agentConfig),
        stream: true,
        messages: messageList,
      });
      let finalContent = "";
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          process.stdout.write(delta);
          finalContent += delta;
          streamHandler?.onContentDelta?.(delta);
        }
      }
      streamHandler?.onContentDone?.();
    } catch (error) {
      streamHandler?.onError?.(error as Error);
      throw error;
    }
  }

  public createHttpStreamHandler(write: (chunk: string) => void): EventHandler {
    return this.streamHandler.createHttpStreamHandler(write);
  }
}
