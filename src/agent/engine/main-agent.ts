import OpenAI from "openai";
import { ChatCompletionFunctionTool, ChatCompletionToolChoiceOption } from "openai/resources";
import { StreamHandler } from "../handlers/stream-handler";
import { ConversationStore, type AppendMessageInput } from "../memory";
import { buildBashBlacklistSystemPrompt } from "../permission";
import {
  COMPLEXITY_ROUTE_CONFIG_MAP,
  complexityAnalyze,
  ComplexityAnalyzeResult,
} from "../sub-agent/complexity-analyze-agent";
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
  SYSTEM_PROMPT,
} from "../types/agent";
import { HookManager } from "./hook-manager";
import { LlmService } from "./llm-service";
import { ToolManager } from "./tool-manager";

// 在标准 ChatCompletion 参数之上，按 provider 叠加 thinking 开关字段：
// QWEN 用顶层 enable_thinking:boolean；DOUBAO 用 thinking:{type:"enabled"|"disabled"}。
type ThinkingCapableParams = ChatCompletionBaseParams & {
  enable_thinking?: boolean;
  thinking?: { type: "enabled" | "disabled" };
};

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
  private conversationStore: ConversationStore;

  constructor() {
    this.hookManager = new HookManager();
    this.streamHandler = new StreamHandler();
    this.toolManager = new ToolManager(this.hookManager, this.streamHandler);
    this.llmService = new LlmService();
    this.conversationStore = new ConversationStore();
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

  // 按 provider 构建大模型 thinking 开关参数，needThinking 来自复杂度分析的 routeTarget 推导。
  private buildThinkingParam(
    provider: LlmProviderName,
    needThinking: boolean,
  ): { enable_thinking: boolean } | { thinking: { type: "enabled" | "disabled" } } {
    if (provider === "QWEN") {
      return { enable_thinking: needThinking };
    }
    return { thinking: { type: needThinking ? "enabled" : "disabled" } };
  }

  // 将主 agent 的基础指令、复杂度路由结果和权限约束统一收口到同一条 system prompt。
  private buildSystemPrompt(requestId: string, complexityResult: ComplexityAnalyzeResult): string {
    const routeConfig = COMPLEXITY_ROUTE_CONFIG_MAP[complexityResult.routeTarget];

    return [
      SYSTEM_PROMPT,
      "意图识别路由结果:",
      JSON.stringify(complexityResult),
      routeConfig.extraPrompt,
      buildBashBlacklistSystemPrompt(requestId),
    ].join("\n");
  }

  /**
   * 非末轮（工具决策轮）非流式，末轮（最终答案）真实流式：
   *   复杂度分析 -> 准备上下文 -> [非流式工具循环：仅模型调工具时继续，不调工具则丢弃草稿 break]
   *   -> (达到最大轮次则注入 FINAL_MESSAGE) -> 末轮流式拿最终答案
   * Stop hook 仅在最终 finally 触发一次；最终答案落库。
   */
  public async sendThinkingStreamMessage(
    sessionId: string,
    requestId: string,
    userId: string,
    message: string,
    modelProvider: LlmProviderName,
    streamHandler?: EventHandler,
  ): Promise<void> {
    const { client: agentClient, config: agentConfig } = this.llmService.getClientBundle(modelProvider);
    if (streamHandler) {
      this.streamHandler.setEventHandler(streamHandler);
    }

    // 复杂度分析 -> 路由配置 / thinking 开关 / 工具轮次预算
    const complexityResult = await complexityAnalyze(message);
    const routeConfig = COMPLEXITY_ROUTE_CONFIG_MAP[complexityResult.routeTarget];
    const thinkingParam = this.buildThinkingParam(modelProvider, complexityResult.needThinking);
    const maxToolRounds = routeConfig.maxLoopLimit;
    const baseConfig: ThinkingCapableParams = {
      ...this.buildCompletionOptions(agentConfig),
      ...thinkingParam,
      temperature: routeConfig.temperature,
    };
    const agentContext = { requestId, userId, modelProvider };

    // 构建上下文（历史 + 本轮 system/user）并持久化 system、user
    const messageList = await this.prepareContext(sessionId, requestId, userId, message, complexityResult);
    await this.hookManager.triggerHooks("UserPromptSubmit", { ...agentContext, prompt: message });

    let stopReason: AgentStopReason = "completed";
    let stopError: Error | undefined;
    let reachedAnswer = false;

    streamHandler?.onThinkingStart?.();
    streamHandler?.onContentStart?.();

    try {
      // === 非流式工具循环：只在模型调用工具时继续；模型不再调工具则丢弃本轮草稿，转末轮流式 ===
      let loopRound = 0;
      while (loopRound < maxToolRounds) {
        const completion = await agentClient.chat.completions.create({
          ...baseConfig,
          stream: false,
          messages: messageList,
        } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);
        const assistantMessage = completion.choices?.[0]?.message;
        const toolCalls = assistantMessage?.tool_calls ?? [];
        console.log("Assistant Message:", assistantMessage);

        if (toolCalls.length === 0) {
          // 模型不再调工具 => 准备出答案，丢弃本轮草稿（末轮会重新流式生成）
          reachedAnswer = true;
          break;
        }

        // 持久化 + 追加 assistant 工具决策（含 tool_calls）
        await this.persistMessage(
          sessionId,
          requestId,
          "assistant",
          assistantMessage?.content ?? null,
          userId,
          { tool_calls: toolCalls as unknown as AppendMessageInput["tool_calls"] },
        );
        messageList.push({
          role: "assistant",
          content: assistantMessage?.content ?? null,
          tool_calls: toolCalls,
        } as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam);
        loopRound += 1;

        // 执行工具（tool-manager 内部自动发 onToolUseStart/Done）
        for (const tool of toolCalls) {
          if (tool.type !== "function") {
            continue;
          }
          console.log(
            `Executing tool: ${tool.function.name} (id: ${tool.id}) with arguments:`,
            tool.function.arguments,
          );

          const toolResult = await this.toolManager.executeToolHandler(
            requestId,
            userId,
            modelProvider,
            tool.id,
            tool.function.name,
            tool.function.arguments,
          );
          const toolContent = JSON.stringify(toolResult.output);
          messageList.push({
            role: "tool",
            tool_call_id: tool.id,
            content: toolContent,
          });
          await this.persistMessage(sessionId, requestId, "tool", toolContent, userId, {
            tool_call_id: tool.id,
          });
        }
      }

      // === 末轮：真实流式拿最终答案 ===
      if (!reachedAnswer) {
        // 达到最大轮次，注入 FINAL_MESSAGE
        stopReason = "max_tool_rounds";
        messageList.push({ role: "user", content: FINAL_MESSAGE });
        await this.persistMessage(sessionId, requestId, "user", FINAL_MESSAGE, userId);
      } else {
        stopReason = "stop";
      }

      const finalStream = await agentClient.chat.completions.create({
        ...baseConfig,
        stream: true,
        messages: messageList,
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming);
      const finalAnswer = await this.consumeStream(finalStream, streamHandler);
      await this.persistMessage(sessionId, requestId, "assistant", finalAnswer, userId);

      streamHandler?.onContentDone?.();
    } catch (error) {
      stopReason = "error";
      stopError = error as Error;
      streamHandler?.onError?.(error as Error);
      throw error;
    } finally {
      streamHandler?.onThinkingDone?.();
      await this.hookManager.triggerHooks("Stop", {
        ...agentContext,
        prompt: message,
        reason: stopReason,
        error: stopError,
      });
    }
  }

  // 构建本轮上下文 messageList = [system, ...历史非system, user]，并持久化 system、user。
  private async prepareContext(
    sessionId: string,
    requestId: string,
    userId: string,
    message: string,
    complexityResult: ComplexityAnalyzeResult,
  ): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    const historyContext = await this.conversationStore.getLLMContext(sessionId);
    // 过滤历史中的旧 system 消息，本轮会重新构建；
    // RawLLMMessage 的 content 允许 null，需转换为 OpenAI 兼容类型
    const historyNonSystem = historyContext
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.tool_calls && { tool_calls: m.tool_calls }),
        ...(m.tool_call_id && { tool_call_id: m.tool_call_id }),
      })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[];

    const systemPromptContent = this.buildSystemPrompt(requestId, complexityResult);
    const messageList: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPromptContent },
      ...historyNonSystem,
      { role: "user", content: message },
    ];

    await this.persistMessage(sessionId, requestId, "system", systemPromptContent, userId);
    await this.persistMessage(sessionId, requestId, "user", message, userId);

    return messageList;
  }

  // 消费末轮流式响应：累积 delta.content 并实时下发 onContentDelta。末轮只产出答案，不处理 tool_calls。
  private async consumeStream(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
    streamHandler: EventHandler | undefined,
  ): Promise<string> {
    let content = "";
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        content += delta;
        streamHandler?.onContentDelta?.(delta);
      }
    }
    return content;
  }

  // 统一持久化消息，消除各处 appendMessage 样板。
  private async persistMessage(
    sessionId: string,
    requestId: string,
    role: AppendMessageInput["role"],
    content: string | null,
    userId: string,
    extras?: { tool_calls?: AppendMessageInput["tool_calls"]; tool_call_id?: string },
  ): Promise<void> {
    await this.conversationStore.appendMessage(
      {
        sessionId,
        requestId,
        role,
        content,
        ownerUserId: userId,
        ...extras,
      } as AppendMessageInput,
      sessionId,
      requestId,
    );
  }

  public createHttpStreamHandler(write: (chunk: string) => void): EventHandler {
    return this.streamHandler.createHttpStreamHandler(write);
  }
}
