type PendingDecision = {
  resolve: (allow: boolean) => void;
  timer?: NodeJS.Timeout;
};

class PermissionStore {
  private pending = new Map<string, PendingDecision>();

  /**
   * 挂起等待用户对指定 requestId 的 allow/deny 决策。
   * 未传 timeoutMs 时将一直等待人工审核。
   * 传入 timeoutMs 后，超时自动 deny，防止 Loop 永久阻塞。
   */
  waitForDecision(requestId: string, timeoutMs?: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const timer =
        typeof timeoutMs === "number" && timeoutMs > 0
          ? setTimeout(() => {
              if (this.pending.has(requestId)) {
                this.pending.delete(requestId);
                resolve(false);
              }
            }, timeoutMs)
          : undefined;

      this.pending.set(requestId, { resolve, timer });
    });
  }

  /**
   * 外部（HTTP 路由）收到用户决策后，通过此方法唤醒对应挂起的 Promise。
   */
  resolveDecision(requestId: string, allow: boolean): void {
    const entry = this.pending.get(requestId);
    if (!entry) return;
    if (entry.timer) {
      clearTimeout(entry.timer);
    }
    this.pending.delete(requestId);
    entry.resolve(allow);
  }
}

export const permissionStore = new PermissionStore();
