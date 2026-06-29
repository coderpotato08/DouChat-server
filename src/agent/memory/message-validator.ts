import { MessageRole } from "./constants";
import { MessageValidateError } from "./errors";
import type { ChatMessageEntity } from "./mongo-repo";

/**
 * 可校验消息子集（仅包含校验所需字段）
 */
type ValidatableMessage = Pick<
  ChatMessageEntity,
  "role" | "content" | "tool_calls" | "tool_call_id"
>;

/**
 * MessageValidator — 消息合法性校验器
 *
 * 在消息写入数据库前执行校验，比 Mongoose pre-validate hook 更早发现问题，
 * 并抛出领域专用异常 MessageValidateError。
 */
export class MessageValidator {
  /**
   * 校验消息格式合法性，不合法时抛出 MessageValidateError
   *
   * 校验规则：
   * 1. role 字段仅允许枚举内合法值
   * 2. 仅 assistant 角色允许 content 为 null（工具调用场景），其余角色禁止空内容
   * 3. tool_calls 仅允许 assistant 角色
   * 4. tool_call_id 仅允许 tool 角色
   * 5. tool 角色必须提供 tool_call_id
   * 6. 超长内容前置拦截
   */
  static validate(
    msg: ValidatableMessage,
    maxRawMessageLength?: number,
  ): void {
    // 规则 1: role 合法性
    const validRoles = Object.values(MessageRole) as string[];
    if (!validRoles.includes(msg.role)) {
      throw new MessageValidateError(
        `Invalid message role: "${msg.role}". Must be one of: ${validRoles.join(", ")}`,
      );
    }

    // 规则 2: content 空值检查
    if (msg.role !== MessageRole.ASSISTANT && (msg.content === null || msg.content === undefined)) {
      throw new MessageValidateError(
        `Content can only be null/undefined for assistant messages. Got role: "${msg.role}"`,
      );
    }

    // 规则 3: tool_calls 仅限 assistant
    if (msg.role !== MessageRole.ASSISTANT && msg.tool_calls && msg.tool_calls.length > 0) {
      throw new MessageValidateError(
        `tool_calls is only allowed for assistant messages. Got role: "${msg.role}"`,
      );
    }

    // 规则 4 & 5: tool_call_id 约束
    if (msg.role === MessageRole.TOOL) {
      if (!msg.tool_call_id) {
        throw new MessageValidateError(
          "tool_call_id is required for tool messages",
        );
      }
    } else {
      if (msg.tool_call_id) {
        throw new MessageValidateError(
          `tool_call_id is only allowed for tool messages. Got role: "${msg.role}"`,
        );
      }
    }

    // 规则 6: 超长内容拦截
    if (maxRawMessageLength && typeof msg.content === "string") {
      if (msg.content.length > maxRawMessageLength) {
        throw new MessageValidateError(
          `Message content exceeds max length: ${msg.content.length} > ${maxRawMessageLength}`,
        );
      }
    }
  }
}
