/**
 * StoreError — 会话存储模块基类顶层异常
 */
export class StoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "StoreError";
    if (options?.cause !== undefined) {
      (this as unknown as { cause: unknown }).cause = options.cause;
    }
  }
}

/**
 * SessionNotFoundError — 会话不存在异常
 */
export class SessionNotFoundError extends StoreError {
  constructor(sessionId: string, options?: { cause?: unknown }) {
    super(`Session not found: ${sessionId}`, options);
    this.name = "SessionNotFoundError";
  }
}

/**
 * CompressStrategyNotFoundError — 压缩策略未注册异常
 */
export class CompressStrategyNotFoundError extends StoreError {
  constructor(strategy: string, options?: { cause?: unknown }) {
    super(`Compress strategy not registered: ${strategy}`, options);
    this.name = "CompressStrategyNotFoundError";
  }
}

/**
 * MessageRollbackFailedError — 压缩回滚失败异常
 */
export class MessageRollbackFailedError extends StoreError {
  constructor(messageId: string, options?: { cause?: unknown }) {
    super(`Message rollback failed for message: ${messageId}`, options);
    this.name = "MessageRollbackFailedError";
  }
}

/**
 * MessageValidateError — 消息格式校验失败异常
 */
export class MessageValidateError extends StoreError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(`Message validation failed: ${message}`, options);
    this.name = "MessageValidateError";
  }
}
