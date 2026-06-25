# TypeScript 编码规范

## 命名约定

| 类型 | 风格 | 示例 |
|------|------|------|
| 文件 | kebab-case | `main-agent.ts`, `llm-service.ts` |
| 目录 | kebab-case 或 camelCase | `sub-agent/`, `TodoManager/` |
| 类 | PascalCase | `MainAgent`, `ToolManager`, `HookManager` |
| 函数/变量 | camelCase | `buildSystemPrompt`, `getClientBundle` |
| 常量 | UPPER_SNAKE | `MAX_TODO_ITEMS`, `DEFAULT_MAX_CONTEXT_MESSAGES` |
| 接口/类型 | PascalCase | `EventHandler`, `ToolExecutionResponse` |
| 枚举 | PascalCase | （项目中未使用 enum，用 const assertion + 联合类型代替） |

## 类型注解

- 所有函数/方法必须有参数类型和返回值类型注解
- 禁止使用 `any`（除非有 `// eslint-disable-next-line` 注释说明理由）
- 类型推导足够时可以不显式注解变量类型

## 类型文件组织

| 类型所属 | 放置位置 |
|---------|---------|
| Agent 核心类型 | `src/agent/types/agent.ts` |
| 工具类型 | `src/agent/types/tools.ts` |
| API 校验 Schema | `src/controllers/ai/validator.ts` |
| 会话上下文类型 | `src/agent/memory/type.ts` |
| 全局常量 | `src/constant/` |
| 模块内部类型 | 就近放置在同文件顶部 |

## 文件组织

- 每个文件只导出一个核心类/函数
- 相关的辅助函数/类型放在同一文件
- 单文件不超过 300 行（有充分理由除外）

## 常见模式

### 单例模式

```ts
let instance: Foo | null = null;
export function initFoo(): Foo { … }
export function getFoo(): Foo { … }
```

项目中已有此模式的文件：
- `src/agent/engine/main-agent.ts` — `initMainAgent()` / `getMainAgent()`
- `src/agent/sub-agent/complexity-analyze-agent.ts` — 内部单例

### Zod Schema 校验

```ts
// 定义 Schema
export const fooBodySchema = z.object({ … });
export type FooBody = z.output<typeof fooBodySchema>;

// 路由中使用
router.post("/foo", validateRequest({ body: fooBodySchema }), handler);

// Controller 中获取
const { body } = getValidatedRequestData<FooBody>(ctx);
```
