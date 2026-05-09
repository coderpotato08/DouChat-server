import { EventHandler } from "../types/agent";

export class StreamHandler {
  private eventHandler: EventHandler;
  constructor(eventHandler: EventHandler = {}) {
    this.eventHandler = eventHandler;
  }

  createHttpStreamHandler(write: (chunk: string) => void): EventHandler {
    return {
      onContentStart: async () => {
        write("data: " + JSON.stringify({ type: "content_start" }) + "\n\n");
      },
      onContentDelta: async (delta: string) => {
        write("data: " + JSON.stringify({ type: "content_delta", delta }) + "\n\n");
      },
      onContentDone: async () => {
        write("data: " + JSON.stringify({ type: "content_done" }) + "\n\n");
      },
      onThinkingStart: async () => {
        write("data: " + JSON.stringify({ type: "thinking_start" }) + "\n\n");
      },
      onThinkingDelta: async (delta: string) => {
        write("data: " + JSON.stringify({ type: "thinking_delta", delta }) + "\n\n");
      },
      onThinkingDone: async () => {
        write("data: " + JSON.stringify({ type: "thinking_done" }) + "\n\n");
      },
      onToolUseStart: async (toolName: string, toolUseId: string, input?: string) => {
        write("data: " + JSON.stringify({ type: "tool_use_start", toolName, toolUseId, input }) + "\n\n");
      },
      onToolUseDone: async (toolName: string, toolUseId: string, output: string) => {
        write("data: " + JSON.stringify({ type: "tool_use_done", toolName, toolUseId, output }) + "\n\n");
      },
      onError: async (error: Error) => {
        write("data: " + JSON.stringify({ type: "error", error: error.message }) + "\n\n");
      },
    };
  }
}
