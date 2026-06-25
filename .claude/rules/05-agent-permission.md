# Agent 权限系统规范

> 源码位置：`src/agent/permission/`

## 文件清单

| 文件 | 导出 | 职责 |
|------|------|------|
| `index.ts` | `checkBashCmdPermission`, `checkCommandPermissionRules`, `buildBashBlacklistSystemPrompt`, `askUserForPermission`, `isPathWithin`, `ensureWithinWorkspace`, `WORKSPACE`, `bashBlacklistStore`, `permissionStore` | 权限策略入口，统一调度 sandbox/preflight/confirm |
| `permission-store.ts` | `permissionStore: PermissionStore` | 人工审批决策挂起/唤醒（Promise 模式） |
| `bash-blacklist-store.ts` | `bashBlacklistStore: BashBlacklistStore` | 会话级 bash 高危命令黑名单（AsyncLocalStorage 绑定 session） |
| `bash-cmd-patterns.ts` | `dangerousCmdPatterns`, `sensitiveCmdPatterns` | 危险命令模式（强制禁止）和敏感命令模式（需人工确认） |

## 权限策略表

`toolPermissionPolicies` 在 `index.ts` 中定义，按工具名分发，每个策略分三个阶段：

```ts
type ToolPermissionPolicy = {
  sandbox?: (params) => void;       // 1. 路径/工作目录硬约束校验
  preflight?: (params) => void;     // 2. 会话黑名单前置拒绝
  confirm?: ConfirmationRule[];     // 3. 命中后转人工确认
};
```

当前已配置策略的工具：

| 工具 | sandbox | preflight | confirm |
|------|:-------:|:---------:|:-------:|
| `safe_path` | ✅ | — | — |
| `run_bash` | ✅ | ✅ (bash 黑名单) | ✅ (敏感命令) |
| `run_read` | ✅ | — | — |
| `run_write` | ✅ | — | ✅ (覆盖模式) |

## 危险命令（强制禁止）

定义在 `dangerousCmdPatterns`，命中后：
1. 直接拦截本次执行
2. 将命令模板记入当前会话黑名单
3. 黑名单模板注入后续 system prompt

覆盖的命令：`rm -rf`、`find /`、`ls -la /`、`rm`、`rmdir`、`mv`、`dd`、`mkfs`、`chmod`、`chown`、`find -delete`、`git clean`、`git reset --hard`、`sudo`

## 敏感命令（需人工确认）

定义在 `sensitiveCmdPatterns`，命中后：
1. 不直接拦截
2. 通过 `askUserForPermission` 发起人工确认请求
3. 用户通过 `/ai/agent/permission` 接口响应决策

覆盖的命令：`git commit/push/merge/rebase`、输出重定向 `>`、`npm publish/install`、`pnpm install`、`yarn add`

## 人工审批流程

```
工具执行前 → checkCommandPermissionRules() 返回确认消息
  → askUserForPermission(message, eventHandler)
    → eventHandler.onPermissionRequest(requestId, message)  [通过 SSE 通知前端]
    → permissionStore.waitForDecision(requestId)            [挂起等待]
      → 前端用户点击允许/拒绝
        → POST /ai/agent/permission { requestId, allow }
          → permissionStore.resolveDecision(requestId, allow)
            → waitForDecision 的 Promise resolve
              → 返回 true/false 给 PreToolUse Hook
```

## 会话级 Bash 黑名单

- 使用 `AsyncLocalStorage` 绑定 sessionId，无需显式透传
- 入口：`bashBlacklistStore.runWithSession(requestId, task)`
- 累计触发 2 次后收回 `run_bash` 工具权限
- 黑名单摘要通过 `buildBashBlacklistSystemPrompt(sessionId)` 注入 system prompt
