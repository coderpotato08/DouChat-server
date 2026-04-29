import { initMainAgent } from "../src/agent/engine/main-agent";

// 初始化agent
const agent = initMainAgent();
agent.sendThinkingStreamMessage('afawfafwawaaf', '请帮我读取当前目录下的README.md文件内容，并总结描述');