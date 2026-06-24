import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { SystemLogger } from "../../console";
import { LlmService } from "../engine/llm-service";

const COMPLEXITY_LEVELS = ["simple", "medium", "complex"] as const;
const ROUTE_TARGETS = ["direct_answer", "agent_loop", "light_thinking"] as const;

const complexityAnalyzeResultSchema = z.object({
  complexityLevel: z.enum(COMPLEXITY_LEVELS),
  confidence: z.number().min(0).max(1),
  routeTarget: z.enum(ROUTE_TARGETS),
  judgeFactors: z.array(z.string().min(1)).min(1).max(5),
  tokenCost: z.number().min(0).max(1),
});

const DEFAULT_COMPLEXITY_ANALYZE_RESULT = {
  complexityLevel: "simple",
  confidence: 1,
  routeTarget: "direct_answer",
  judgeFactors: ["空输入"],
  tokenCost: 0,
} satisfies z.infer<typeof complexityAnalyzeResultSchema>;

export type ComplexityAnalyzeResult = z.infer<typeof complexityAnalyzeResultSchema>;
export type ComplexityLevel = ComplexityAnalyzeResult["complexityLevel"];
export type ComplexityRouteTarget = ComplexityAnalyzeResult["routeTarget"];

export const COMPLEXITY_ROUTE_CONFIG_MAP: Record<
  ComplexityRouteTarget,
  {
    extraPrompt: string;
    maxLoopLimit: number;
    temperature: number;
  }
> = {
  direct_answer: {
    extraPrompt: "优先直接回答。除非用户请求本身明确依赖工具、文件读写或多步执行，否则不要调用工具。",
    maxLoopLimit: 5,
    temperature: 0.2,
  },
  light_thinking: {
    extraPrompt: "优先做轻量分析并直接回答。只有在缺少关键信息且工具确实必要时才调用工具。",
    maxLoopLimit: 5,
    temperature: 0.3,
  },
  agent_loop: {
    extraPrompt: "可以进入完整 agent loop，按需使用 todo 和其他工具完成任务。",
    maxLoopLimit: 20,
    temperature: 0.4,
  },
};

const COMPLEXITY_ANALYZE_SYSTEM_PROMPT = `你是一个复杂度分析子代理，只负责分析用户本轮 prompt 的任务复杂度并输出 JSON。

分析规则：
1. 不要回答用户问题本身，不要给解决方案。
2. 只基于 prompt 语义判断复杂度、预估路由和成本。
3. complexityLevel 只能是 simple、medium、complex。
4. routeTarget 只能是 direct_answer、light_thinking、agent_loop。
5. judgeFactors 输出 1 到 5 条简短中文短语。
6. confidence 输出 0 到 1 之间的小数，表示判断置信度。
7. tokenCost 输出 0 到 1 之间的小数，表示后续处理该请求的大致相对成本，数值越大代表越复杂。
8. 简单、直接、单意图、无需外部工具或多步推理的问题，更偏向 simple 和 direct_answer。
9. 需要少量分析但通常不需要工具调用的问题，更偏向 medium 和 light_thinking。
10. 涉及多目标、强工具依赖、跨文件排查、复杂规划或长上下文的问题，更偏向 complex 和 agent_loop。
11. 只输出单个 JSON 对象，不要输出 Markdown，不要输出代码块，不要输出额外说明。`;

type NonStreamingCompletionParams = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & {
  extra_body?: {
    enable_thinking?: boolean;
  };
};

class ComplexityAnalyzeAgent {
  private readonly llmService = new LlmService();

  public async invoke(prompt: string): Promise<ComplexityAnalyzeResult> {
    const startedAt = Date.now();
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) {
      this.printIntentRecognizedLog(DEFAULT_COMPLEXITY_ANALYZE_RESULT, startedAt, false);
      return DEFAULT_COMPLEXITY_ANALYZE_RESULT;
    }

    try {
      const model = process.env.COMPLEXITY_ANALYZE_FLASH_MODAL?.trim();
      if (!model) {
        this.printIntentRecognizedLog(DEFAULT_COMPLEXITY_ANALYZE_RESULT, startedAt, false);
        return DEFAULT_COMPLEXITY_ANALYZE_RESULT;
      }

      const { client } = this.llmService.getClientBundle("QWEN");
      const requestPayload: NonStreamingCompletionParams = {
        model,
        stream: false,
        temperature: 0.1,
        top_p: 0.1,
        response_format: zodResponseFormat(complexityAnalyzeResultSchema, "complexity_analyze_result"),
        extra_body: {
          enable_thinking: false,
        },
        messages: [
          {
            role: "system",
            content: COMPLEXITY_ANALYZE_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: normalizedPrompt,
          },
        ],
      };
      const completion = await client.chat.completions.create(
        requestPayload as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
      );

      const rawContent = this.getMessageContent(completion.choices[0]?.message?.content);
      const result = this.parseResult(rawContent);
      this.printIntentRecognizedLog(result, startedAt, true);
      return result;
    } catch(error) {
      console.log("❗️复杂度分析子代理执行失败，使用默认结果。", error);
      this.printIntentRecognizedLog(DEFAULT_COMPLEXITY_ANALYZE_RESULT, startedAt, false);
      return DEFAULT_COMPLEXITY_ANALYZE_RESULT;
    }
  }

  private printIntentRecognizedLog(
    result: ComplexityAnalyzeResult,
    startedAt: number,
    success: boolean,
  ): void {
    SystemLogger.agent()
      .intentRecognized({
        success,
        durationMs: Date.now() - startedAt,
        complexityLevel: result.complexityLevel,
        confidence: result.confidence,
        routeTarget: result.routeTarget,
        tokenCost: result.tokenCost,
        judgeFactors: result.judgeFactors,
      })
      .printLog();
  }

  private getMessageContent(
    content: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam["content"] | null | undefined,
  ): string {
    if (typeof content === "string") {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === "string") {
            return part;
          }

          if (part.type === "text") {
            return part.text;
          }

          return "";
        })
        .join("")
        .trim();
    }

    return "";
  }

  private parseResult(rawContent: string): ComplexityAnalyzeResult {
    if (!rawContent) {
      throw new Error("ComplexityAnalyzeAgent returned empty content.");
    }

    const normalizedContent = rawContent
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(normalizedContent);
    } catch (error) {
      throw new Error(
        `ComplexityAnalyzeAgent returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return complexityAnalyzeResultSchema.parse(parsed);
  }
}

let complexityAnalyzeAgentInstance: ComplexityAnalyzeAgent | null = null;

function getComplexityAnalyzeAgentInstance(): ComplexityAnalyzeAgent {
  if (!complexityAnalyzeAgentInstance) {
    complexityAnalyzeAgentInstance = new ComplexityAnalyzeAgent();
  }

  return complexityAnalyzeAgentInstance;
}

export async function complexityAnalyze(prompt: string): Promise<ComplexityAnalyzeResult> {
  return getComplexityAnalyzeAgentInstance().invoke(prompt);
}
