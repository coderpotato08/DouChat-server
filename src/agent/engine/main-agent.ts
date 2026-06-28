import OpenAI from "openai";
import { ChatCompletionFunctionTool, ChatCompletionToolChoiceOption } from "openai/resources";
import { StreamHandler } from "../handlers/stream-handler";
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

  // 将主 agent 的基础指令、复杂度路由结果和权限约束统一收口到同一条 system prompt。
  private buildSystemPrompt(requestId: string, complexityResult: ComplexityAnalyzeResult): string {
    const routeConfig = COMPLEXITY_ROUTE_CONFIG_MAP[complexityResult.routeTarget];

    return [
      SYSTEM_PROMPT,
      "Complexity routing result:",
      JSON.stringify(complexityResult),
      routeConfig.extraPrompt,
      buildBashBlacklistSystemPrompt(requestId),
    ].join("\n");
  }

  public async sendThinkingStreamMessage(
    requestId: string,
    userId: string,
    message: string,
    modelProvider: LlmProviderName,
    streamHandler?: EventHandler,
  ) {
    const { client: agentClient, config: agentConfig } = this.llmService.getClientBundle(modelProvider);
    // 在进入主循环前先做一次轻量复杂度分析，用于约束本轮回答的工具偏好和循环预算。
    const complexityResult = await complexityAnalyze(message);
    const routeConfig = COMPLEXITY_ROUTE_CONFIG_MAP[complexityResult.routeTarget];
    // loop 轮询次数
    let loopRound = 0;
    // agent loop 终止原因
    let stopReason: AgentStopReason = "completed";
    // agent loop 异常终止错误
    let stopError: Error | undefined;
    let reachedNoToolRound = false;
    // 统一上下文信息
    const agentContext = { requestId, userId, modelProvider };
    streamHandler?.onContentStart?.();
    const messageList: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: this.buildSystemPrompt(requestId, complexityResult),
      },
    ];
    const baseConfig: ChatCompletionBaseParams = {
      ...this.buildCompletionOptions(agentConfig),
      temperature: routeConfig.temperature,
    };
    // 非 agent_loop 路由下压低工具轮次，避免简单问题进入冗长的工具循环。
    const maxToolRounds = routeConfig.maxLoopLimit;
    await this.hookManager.triggerHooks("UserPromptSubmit", { ...agentContext, prompt: message });
    messageList.push({
      role: "user",
      content: message,
    });
    if (streamHandler) {
      this.streamHandler.setEventHandler(streamHandler);
    }
    // 首轮loop
    if (loopRound < maxToolRounds) {
      let firstRoundContent = "";
      let firstRoundFinishReason: OpenAI.Chat.Completions.ChatCompletionChunk.Choice["finish_reason"] = null;

      streamHandler?.onThinkingStart?.();
      try {
        const firstRoundStream = await agentClient.chat.completions.create({
          ...baseConfig,
          stream: true,
          messages: messageList,
        });

        for await (const chunk of firstRoundStream) {
          const choice = chunk.choices?.[0];
          if (!choice) {
            continue;
          }
          firstRoundFinishReason = choice.finish_reason ?? firstRoundFinishReason;
          const delta = choice.delta;
          const content = delta?.content || (delta as any)?.reasoning_content;
          if (content) {
            process.stdout.write(content);
            firstRoundContent += content;
            streamHandler?.onThinkingDelta?.(content);
          }
        }
        process.stdout.write("\n");
        streamHandler?.onContentDone?.();

        const assistantMessage: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam = {
          role: "assistant",
          content: firstRoundContent || null,
        };
        messageList.push(assistantMessage);
        loopRound += 1;

        if (firstRoundFinishReason === "stop") {
          reachedNoToolRound = true;
          stopReason = "stop";
          return;
        }
      } catch (error) {
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

    while (!reachedNoToolRound && loopRound < maxToolRounds) {
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
        loopRound += 1;
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
      messageList.push({
        role: "user",
        content: FINAL_MESSAGE,
      });
    }

    let stream: Awaited<ReturnType<typeof agentClient.chat.completions.create>>;
    try {
      stream = await agentClient.chat.completions.create({
        ...this.buildCompletionOptions(agentConfig),
        temperature: routeConfig.temperature,
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
      process.stdout.write("\n");
      streamHandler?.onContentDone?.();
      console.log("messageList", messageList);
    } catch (error) {
      stopReason = "error";
      stopError = error as Error;
      streamHandler?.onError?.(error as Error);
      throw error;
    } finally {
      await this.hookManager.triggerHooks("Stop", {
        ...agentContext,
        prompt: message,
        reason: stopReason,
        error: stopError,
      });
    }
  }

  public createHttpStreamHandler(write: (chunk: string) => void): EventHandler {
    return this.streamHandler.createHttpStreamHandler(write);
  }
}
