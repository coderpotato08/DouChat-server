import {
  AgentHookCallback,
  AgentHookContextMap,
  AgentHookEventName,
  AgentHooks,
  AgentHookTriggerResultMap,
} from "../types/agent";

export class HookManager {
  private readonly hooks: {
    UserPromptSubmit: NonNullable<AgentHooks["UserPromptSubmit"]>[];
    PreToolUse: NonNullable<AgentHooks["PreToolUse"]>[];
    PostToolUse: NonNullable<AgentHooks["PostToolUse"]>[];
    Stop: NonNullable<AgentHooks["Stop"]>[];
  } = {
    UserPromptSubmit: [],
    PreToolUse: [],
    PostToolUse: [],
    Stop: [],
  };

  public registerHooks<TEventName extends AgentHookEventName>(
    event: TEventName,
    callback: AgentHookCallback<TEventName>,
  ): void {
    this.hooks[event].push(callback as never);
  }

  public async triggerHooks<TEventName extends AgentHookEventName>(
    eventName: TEventName,
    context: AgentHookContextMap[TEventName],
  ): Promise<AgentHookTriggerResultMap[TEventName]> {
    if (eventName === "PreToolUse") {
      for (const hook of this.hooks.PreToolUse) {
        const result = await hook(context as AgentHookContextMap["PreToolUse"]);
        if (result?.block) {
          return result as AgentHookTriggerResultMap[TEventName];
        }
      }

      return undefined as AgentHookTriggerResultMap[TEventName];
    }

    for (const hook of this.hooks[eventName]) {
      await hook(context as never);
    }

    return undefined as AgentHookTriggerResultMap[TEventName];
  }
}
