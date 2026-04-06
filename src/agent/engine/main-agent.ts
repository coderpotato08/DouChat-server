import { ToolManager } from "./tool-manager";
import { EnvConfig } from "../types/agent";
import OpenAI from "openai";
import { registerBaseTools } from "../tools/baseTools";

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
    const env = {
      baseUrl: process.env.OPENAI_BASE_URL as string,
      apiKey: process.env.OPENAI_API_KEY as string,
      modal: process.env.OPENAI_MODAL as string,
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

  public async buildCompletionOptions() {
    const { baseUrl, apiKey, modal } = this.agentConfig;
    if (!baseUrl || !apiKey || !modal) {
      throw new Error("OpenAI configuration is incomplete. Please check your environment variables.");
    }
    // 获取工具配置
    const toolsConfigs = this.toolManager.getToolsConfig();

    return {
      tool_choice: "auto",
      tools: toolsConfigs,
    };
  }
}
