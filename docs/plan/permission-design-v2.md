# Agent Tool 权限策略收口设计 V2

## 背景

现有设计已经实现了权限请求的中断与恢复机制：

- ToolManager 在工具执行前调用权限规则判断
- 命中规则时，通过 SSE 下发 permission_request
- 客户端回传 allow 或 deny
- PermissionStore 负责挂起与恢复，超时默认 deny

这部分机制本身是成立的，见 [permission-design.md](permission-design.md)。

V2 不再讨论权限中断链路本身，而是聚焦当前权限策略的收口问题：哪些输入应当先被标准化，哪些文件写入应提高确认门槛，哪些 bash 命令应该直接放行、直接拒绝或转人工确认。

---

## 当前问题

当前策略存在三个明显缺口：

1. 路径判断依赖调用参数形态

- workspace 与 sandbox 校验虽然存在，但在规则判定前没有统一的参数规范化层。
- 同一个目标路径如果以相对路径、绝对路径或带 ../ 的形式传入，规则命中的稳定性依赖调用方行为。

2. 文件写入保护过粗

- 当前 run_write 仅在覆盖写时触发确认。
- 对 .env、package.json、锁文件、进程配置、agent 权限策略文件等高价值目标没有额外收口。

3. run_bash 仍以少量黑名单为主

- 现有硬拒绝表只能挡住一部分危险命令。
- 现有人工确认规则也只覆盖少量模式，如 git commit、npm install、输出重定向。
- 对允许集之外的其他命令，没有明确的统一处理策略。

---

## 设计目标

V2 的目标不是重写整套权限系统，而是在不改动现有交互协议的前提下，用最小改动把权限策略收紧到更可控的边界。

目标如下：

1. 所有路径类规则在统一、稳定的输入上运行。
2. 对敏感文件写入增加确认门槛，但不破坏正常开发流。
3. run_bash 从“零散黑名单”提升为“硬拒绝 + 小允许集 + 允许集外人工确认”的明确模型。
4. 不改动现有 SSE 事件格式、HTTP 回写协议、PermissionStore 超时语义。

---

## 总体方案

V2 只做三处收口，按实施顺序如下：

1. 路径输入收口
2. 敏感文件写入收口
3. run_bash 命令执行收口

其中第 3 点的策略已经固定为：

- 高危命令继续硬拒绝
- 明确的低风险允许集直接放行
- 允许集之外一律人工确认

不是“允许集外直接拒绝”，也不是继续堆更多黑名单正则。

---

## 收口点 1：路径输入收口

### 目标

在进入权限规则前，对受控工具的路径参数做一次统一规范化，确保后续 gate 看到的是稳定输入。

### 改动范围

- 文件：src/agent/engine/tool-manager.ts
- 函数：ToolManager.executeToolHandler

### 最小改法

在 JSON.parse(rawArgs) 之后、checkCommandPermissionRules 之前加入轻量参数预处理，仅覆盖以下工具与字段：

- safe_path：sandboxRoot、inputPath
- run_read：filePath
- run_write：filePath
- run_bash：cwd

处理原则：

- 对路径参数做 resolve
- 不引入新的权限判断，只做输入标准化
- 不扩大到所有工具，只处理当前受控工具

### 预期收益

- workspace/sandbox 判断不再依赖调用方传参形式
- 后续敏感文件匹配可以建立在统一路径表示上
- 降低 ../、相对路径、多种输入形式导致的规则歧义

### 风险与边界

- 这是策略地基，必须尽量小心控制影响面
- 只做已知工具字段的预处理，避免误伤未来未纳管工具

---

## 收口点 2：敏感文件写入收口

### 目标

在保留现有“覆盖写需确认”规则的基础上，对高价值目标文件增加额外确认保护。

### 改动范围

- 文件：src/agent/permission/index.ts
- 位置：premessionRules

### 最小改法

新增一条 run_write 规则：

- 如果目标文件属于敏感文件列表，则触发人工确认
- 行为仍然是“确认”，不是“硬拒绝”

首版敏感目标建议包含：

- .env
- package.json
- package-lock.json
- pnpm-lock.yaml
- yarn.lock
- tsconfig.json
- ecosystem.config.js
- src/agent 下的关键策略文件

可优先按文件名和关键目录匹配实现，不引入复杂策略配置。

### 与现有规则的关系

- 原有 run_write 覆盖写确认规则保留
- 敏感文件规则是附加保护，不替代覆盖写规则
- append 写普通文件仍可保持低摩擦

### 预期收益

- 降低依赖投毒、配置劫持、权限策略自修改风险
- 不影响大多数普通文本写入场景

### 风险与边界

- 敏感文件列表必须保持小而关键
- 首版不建议把所有源码文件都纳入敏感集合，否则确认频率会过高

---

## 收口点 3：run_bash 命令执行收口

### 目标

把当前以少量黑名单为主的 run_bash 策略，收敛为更明确的三层模型。

### 固定策略

1. 高危命令：硬拒绝
2. 低风险允许集：直接放行
3. 允许集之外：人工确认

这个决策已经固定，后续实现不再评估“允许集外直接拒绝”。

### 改动范围

- 文件：src/agent/permission/index.ts
- 位置：checkCommandPermission、premessionRules 中的 run_bash 规则
- 协同文件：src/agent/tools/baseTools.ts

### 最小改法

保留现有硬拒绝检测，用于拦截明确高危命令，例如：

- rm
- rmdir
- mv
- dd
- mkfs
- chmod
- chown
- find -delete
- git clean
- git reset --hard
- sudo

在此基础上，为 run_bash 增加一个小型低风险允许集。首版建议只覆盖高频、低副作用查询命令，例如：

- pwd
- ls
- cat
- head
- tail
- grep
- rg
- find（不含删除行为）
- git status
- git diff
- node -v
- npm -v

规则行为为：

- 命中硬拒绝：直接失败
- 命中低风险允许集：直接执行
- 其余命令：触发 permission_request，由用户决定

### 为什么采用人工确认而不是直接拒绝

- 允许集首版一定不完整
- 直接拒绝会显著降低 agent 实用性，并导致大量误拦截
- 人工确认保留了执行能力，同时把未知命令纳入显式授权路径

### 为什么不继续扩展黑名单

- 黑名单天然容易漏项
- shell 变体、组合命令、不同工具链写法会快速扩大维护成本
- 小允许集加人工确认的行为更稳定、更容易解释

### 风险与边界

- 允许集过大，会削弱确认机制意义
- 允许集过小，会提高交互频率
- 首版应优先覆盖“读状态、看环境、查内容”这类低副作用命令，不覆盖安装、写文件、改仓库状态命令

---

## 模块改动清单

| 文件                                 | 改动内容                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| src/agent/engine/tool-manager.ts     | 在 executeToolHandler 中增加受控工具参数规范化层，位置在 JSON.parse(rawArgs) 之后、checkCommandPermissionRules 之前 |
| src/agent/permission/index.ts        | 扩展 permissionRules：新增 run_write 敏感文件确认规则；调整 run_bash 为“允许集外人工确认”                           |
| src/agent/tools/baseTools.ts         | 保持 run_bash 的硬拒绝调用逻辑，确保入口收口后与执行层二次校验一致                                                  |
| src/agent/engine/permission-store.ts | 无协议变更，仅用于验证新增确认规则不会破坏 60s 超时 deny                                                            |
| src/agent/handlers/stream-handler.ts | 无协议变更，继续发出 permission_request                                                                             |
| src/controllers/aiController.ts      | 无协议变更，继续处理 allow/deny 回写                                                                                |

---

## 不改动项

本轮明确不做以下事项：

1. 不改 SSE 事件结构
2. 不改 /agent/permission 请求结构
3. 不引入数据库或 Redis 持久化审批记录
4. 不把 DEFAULT_ALLOW_TOOLS 改造成正式授权源
5. 不引入复杂 shell parser
6. 不把“是否需要权限 gate”抽成工具注册元数据

这些事项可以留到后续版本单独推进。

---

## 验收与验证建议

### 路径规范化验证

1. 对 safe_path、run_read、run_write 分别传入相对路径、绝对路径、带 ../ 的路径
2. 确认进入规则判断前，路径已被规范化
3. 确认 workspace 与 sandbox 拦截语义未被破坏

### 敏感文件写入验证

1. append 写普通文件，不应无意义增加确认
2. 覆盖写普通文件，应保持现有确认逻辑
3. 写入敏感文件，应触发确认
4. 验证确认后 allow/deny 都能正确回传

### run_bash 验证

1. 低风险允许集命令应直接执行
2. 硬拒绝命令应直接失败
3. 允许集外命令应触发 permission_request
4. 用户不响应时，60 秒后自动 deny

### 端到端验证

1. 触发一次正常工具调用，确认不受影响
2. 触发一次人工确认调用，确认 tool_use_start、permission_request、tool_use_done 顺序正常
3. 确认 deny 后 agent 不会永久挂起

---

## 推荐实施顺序

1. 先做路径输入收口
2. 再做敏感文件写入收口
3. 最后做 run_bash 收口

原因是路径规范化是后两项规则的基础；先统一输入，再叠加更细的策略，回归面更可控。

---

## 后续演进方向

如果 V2 落地稳定，下一阶段可考虑：

1. 把“工具是否需要权限 gate”从规则表提升为注册元数据
2. 为敏感文件列表提供集中配置入口
3. 为 run_bash 增加更清晰的命令分类与提示信息
4. 让 LLM 看到结构化的权限拒绝原因，而不是只收到空 output
