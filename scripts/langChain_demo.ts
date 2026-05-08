import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { createDeepAgent } from "deepagents";
import dotenv from "dotenv";
import { createAgent, tool } from "langchain";
import { traceable } from "langsmith/traceable";
import { readFile } from "node:fs/promises";
import path from "node:path";
import z from "zod";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const ARTICLE_FILE_PATH = "/Users/a1234/Desktop/artical.txt";

const SYSTEM_PROMPT = `You are a literary data assistant.

## Capabilities

- \`read_root_article\`: loads the local article text from the project root into the conversation.
Do not guess line counts or positions—ground them in tool results from the saved file.`;

// tool
const readRootArticleTool = tool(
  async (): Promise<string> => {
    try {
      return await readFile(ARTICLE_FILE_PATH, "utf-8");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return `Read failed: ${msg}`;
    }
  },
  {
    name: "read_root_article",
    description: `Read ${ARTICLE_FILE_PATH} from the project root and return the full text.`,
    schema: z.object({}),
  }
);

const checkpointer = new MemorySaver();

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function configureLangSmith() {
  const apiKey = requireEnv("LANGSMITH_API_KEY");
  process.env.LANGSMITH_API_KEY = apiKey;
  process.env.LANGSMITH_TRACING ??= "true";
  process.env.LANGSMITH_ENDPOINT ??= "https://api.smith.langchain.com";
  process.env.LANGSMITH_PROJECT ??= "chat-room-langchain-demo";

  return {
    endpoint: process.env.LANGSMITH_ENDPOINT,
    projectName: process.env.LANGSMITH_PROJECT,
  };
}

function getDemoModelConfig() {
  return {
    apiKey: requireEnv("LANGCHAIN_DEMO_API_KEY"),
    baseURL: requireEnv("LANGCHAIN_DEMO_BASE_URL"),
    model: requireEnv("LANGCHAIN_DEMO_MODEL"),
  };
}

async function main() {
  const langSmith = configureLangSmith();
  const demoModelConfig = getDemoModelConfig();

  // model

  // const model = await initChatModel("qwen3.5-35b-a3b", {
  //   modelProvider: "qwen",
  //   temperature: 0.5,
  //   timeout: 300000,
  //   maxTokens: 25000,
  //   apiKey: process.env.LANGCHAIN_DEMO_API_KEY,
  //   baseUrl: process.env.LANGCHAIN_DEMO_BASE_URL,
  // });

  const model = new ChatOpenAI({
    model: demoModelConfig.model,
    apiKey: demoModelConfig.apiKey,
    configuration: {
      baseURL: demoModelConfig.baseURL,
    },
  });

  const agent = createAgent({
    model,
    tools: [readRootArticleTool],
    systemPrompt: SYSTEM_PROMPT,
    checkpointer,
  });

  const deepAgent = createDeepAgent({
    model,
    tools: [readRootArticleTool],
    systemPrompt: SYSTEM_PROMPT,
    checkpointer,
  });

  const content = `项目根目录下有一篇中文短篇小说。
    文件路径: ${ARTICLE_FILE_PATH}

    请尽可能回答以下问题：

    1) 文中出现了哪些自然景物描写？请列出对应短语。
    2) 小说的主要人物是谁？他做了什么事情？
    3) 用两句话概括小说的氛围与主题。

    如果你无法依据可用工具精确验证某一项，请明确说明限制，不要编造。若遇到错误，请说明错误类型与错误信息。`;

  const agentInput = {
    messages: [new HumanMessage({ content })],
  } as unknown as Parameters<typeof agent.invoke>[0];
  const deepAgentInput = {
    messages: [new HumanMessage({ content })],
  } as unknown as Parameters<typeof deepAgent.invoke>[0];

  // const agentResult = await agent.invoke(agentInput, {
  //   configurable: { thread_id: "great-gatsby-lc" },
  // });
  const deepAgentResult = await deepAgent.invoke(deepAgentInput, {
    configurable: { thread_id: "great-gatsby-da" },
  });

  // const agentMessages = agentResult.messages;
  const deepMessages = deepAgentResult.messages;
  console.log(`LangSmith tracing enabled for project \"${langSmith.projectName}\" via ${langSmith.endpoint}`);
  console.log(content);
  // console.log(agentMessages[agentMessages.length - 1]!.contentBlocks);
  console.log(deepMessages[deepMessages.length - 1]!.contentBlocks);
}

const tracedMain = traceable(main, {
  name: "chat-room-langchain-demo",
  project_name: process.env.LANGSMITH_PROJECT ?? "chat-room-langchain-demo",
  tags: ["demo", "langchain", "langsmith"],
});

tracedMain().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
