我想设计一个上下文会话管理器ConversationStore，该会话管理器将与mongodb数据库进行交互，并在会话进入上下文队列后同步产出给前端的可解析渲染的数据结构。

这是原始需要传递给llm大模型的会话列表数据结构：

```json
[
  {
    "role": "system",
    "content": "You are a coding agent.\n\nComplexity routing result:\n{\"routeTarget\":\"agent_loop\",\"reason\":\"需要读取文件并调用工具完成任务\"}\n\nUse tools when needed."
  },
  {
    "role": "user",
    "content": "请帮我查看 package.json，并总结当前项目的启动命令。"
  },
  {
    "role": "assistant",
    "content": null,
    "tool_calls": [
      {
        "id": "call_read_package_json_001",
        "type": "function",
        "function": {
          "name": "run_read",
          "arguments": "{\"filePath\":\"/Users/coder_potato/Desktop/project/chat-room/DouChat/DouChat-server/package.json\",\"startLine\":1,\"endLine\":120}"
        }
      }
    ]
  },
  {
    "role": "tool",
    "tool_call_id": "call_read_package_json_001",
    "content": "{\"success\":true,\"output\":{\"content\":\"{\\n  \\\"scripts\\\": {\\n    \\\"server\\\": \\\"ts-node src/index.ts\\\",\\n    \\\"build\\\": \\\"tsc\\\",\\n    \\\"test\\\": \\\"vitest\\\"\\n  }\\n}\"}}"
  },
  {
    "role": "assistant",
    "content": "当前项目的主要启动命令是 `npm run server`，构建命令是 `npm run build`，测试命令是 `npm run test`。"
  },
  {
    "role": "user",
    "content": "再帮我检查一下 Agent 工具注册的位置。"
  }
]
```

请你给予上述给到的原始messageList数据结构和我接下来要求你能做到的条件设计一个初步的上下文会话管理器：

1. messageList是最终暴露给llm接口的数据结构，真实数据库内的字段要在此基础上扩展
2. mongo数据库内集合的每条记录对应数组内的单条记录，且必须包含以下字段：
   - sessionId：当前会话id
   - requestId：当前单论用户与AI答复id（用户提出问题的message 和 后续该轮答复的agent loop内产出的message都归属于这条id）
   - messageId：每条message的唯一id
3. 在message消息进入后，需要同步构建messageList（给llm api用）和 给前端渲染的友好数据格式
4. 给前端渲染的友好数据格式需要你进行设计
