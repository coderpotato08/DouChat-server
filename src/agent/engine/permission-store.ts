type PendingDecision = {
  resolve: (allow: boolean) => void;
  timer: NodeJS.Timeout;
};

class PermissionStore {
  private pending = new Map<string, PendingDecision>();

  /**
   * 挂起等待用户对指定 requestId 的 allow/deny 决策。
   * 超时（默认 60s）后自动 deny，防止 Loop 永久阻塞。
   */
  waitForDecision(requestId: string, timeoutMs = 60_000): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        if (this.pending.has(requestId)) {
          this.pending.delete(requestId);
          resolve(false);
        }
      }, timeoutMs);

      this.pending.set(requestId, { resolve, timer });
    });
  }

  /**
   * 外部（HTTP 路由）收到用户决策后，通过此方法唤醒对应挂起的 Promise。
   */
  resolveDecision(requestId: string, allow: boolean): void {
    const entry = this.pending.get(requestId);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(requestId);
    entry.resolve(allow);
  }
}

export const permissionStore = new PermissionStore();
