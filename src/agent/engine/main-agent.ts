import OpenAI from "openai";
import { ChatCompletionFunctionTool, ChatCompletionToolChoiceOption } from "openai/resources";
import { StreamHandler } from "../handlers/stream-handler";
import { buildBashBlacklistSystemPrompt } from "../permission";
import { registerBaseTools } from "../tools/baseTools";
import { registerTodoTools } from "../tools/TodoManager/index";
import {
  AgentHookCallback,
  AgentHookEventName,
  AgentStopReason,
  ChatCompletionBaseParams,
  EnvConfig,
  EventHandler,
  FINAL_MESSAGE,
  LlmProviderName,
  StopHookContext,
  SYSTEM_PROMPT,
  UserPromptSubmitHookContext,
} from "../types/agent";
import { HookManager } from "./hook-manager";
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
  private readonly hookManager: HookManager;
  private llmService: LlmService;
  private toolManager: ToolManager;
  private streamHandler: StreamHandler;

  constructor() {
    this.hookManager = new HookManager();
    this.streamHandler = new StreamHandler();
    this.toolManager = new ToolManager(this.hookManager, this.streamHandler);
    this.llmService = new LlmService();
    // 初始化工具
    try {
      this.toolManager.registerTools([...registerBaseTools(), ...registerTodoTools()]);
    } catch (error) {
      console.error("❗️工具初始化失败:", error);
    }
  }

  public registerHooks<TEventName extends AgentHookEventName>(
    event: TEventName,
    callback: AgentHookCallback<TEventName>,
  ): void {
    this.hookManager.registerHooks(event, callback);
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
    modelProvider: LlmProviderName,
    streamHandler?: EventHandler,
  ) {
    const { client: agentClient, config: agentConfig } = this.llmService.getClientBundle(modelProvider);
    // agent loop 终止原因
    let stopReason: AgentStopReason = "completed";
    // agent loop 异常终止错误
    let stopError: Error | undefined;
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
    const userPromptSubmitContext: UserPromptSubmitHookContext = {
      requestId,
      userId,
      modelProvider,
      prompt: message,
    };
    await this.hookManager.triggerHooks("UserPromptSubmit", userPromptSubmitContext);
    messageList.push({
      role: "user",
      content: message,
    });
    // agent looping
    if (streamHandler) {
      this.streamHandler.setEventHandler(streamHandler);
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
          stopReason = "stop";
          break;
        }
        for (const tool of toolCalls) {
          if (tool.type !== "function") {
            continue;
          }
          const toolResult = await this.toolManager.executeToolHandler(
            requestId,
            userId,
            modelProvider,
            tool.id,
            tool.function.name,
            tool.function.arguments,
          );
          messageList.push({
            role: "tool",
            tool_call_id: tool.id,
            content: JSON.stringify(toolResult.output),
          });
        }
      } catch (error) {
        streamHandler?.onError?.(error as Error);
        throw error;
      }
    }

    if (!reachedNoToolRound) {
      // 达到最大工具调用轮次
      stopReason = "max_tool_rounds";
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
      stopReason = "error";
      stopError = error as Error;
      streamHandler?.onError?.(error as Error);
      throw error;
    } finally {
      const stopContext: StopHookContext = {
        requestId,
        userId,
        modelProvider,
        prompt: message,
        reason: stopReason,
        error: stopError,
      };
      await this.hookManager.triggerHooks("Stop", stopContext);
    }
  }

  public createHttpStreamHandler(write: (chunk: string) => void): EventHandler {
    return this.streamHandler.createHttpStreamHandler(write);
  }
}
