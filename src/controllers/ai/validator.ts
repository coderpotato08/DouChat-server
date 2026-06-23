import z from "zod";
import { LLM_PROVIDER_NAMES } from "../../agent/types/agent";

export const agentCompletionBodySchema = z.object({
  prompt: z.string().trim().min(1, "prompt不能为空"),
  userId: z.string().trim().min(1, "userId不能为空"),
  modelProvider: z.enum(LLM_PROVIDER_NAMES).default("DOUBAO"),
});

export const agentPermissionBodySchema = z.object({
  requestId: z.string().trim().min(1, "requestId 不能为空"),
  allow: z.boolean(),
});

export type AgentCompletionRequestBody = z.output<typeof agentCompletionBodySchema>;
export type AgentPermissionRequestBody = z.output<typeof agentPermissionBodySchema>;
