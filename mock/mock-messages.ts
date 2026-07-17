import type OpenAI from "openai";

/**
 * mock 消息列表 - 用于 compressor 模块（L1/L2/L3/autoCompact）测试
 *
 * 严格遵循 OpenAI ChatCompletionMessageParam 规范：
 * - assistant 带 tool_calls 时 content 为空串；tool_calls[].function.arguments 为 JSON 字符串
 * - tool 消息 content 为序列化后的结果字符串，带 tool_call_id 与对应 assistant tool_call 关联
 *
 * 场景：读取 data/temp.txt 短文 -> 分析优缺点与改进 -> 写入改进版 -> 列目录
 * 覆盖工具：safe_path / run_read / todo / run_write / run_bash
 * 共 3 轮、19 条消息、6 个工具结果（大小不一，便于 L2 占位 / L3 落盘测试）。
 */

const SANDBOX_ROOT =
  "/Users/coder_potato/Desktop/project/chat-room/DouChat/DouChat-server";
const TEMP_FILE = `${SANDBOX_ROOT}/data/temp.txt`;
const IMPROVED_FILE = `${SANDBOX_ROOT}/data/temp_improved.txt`;

const SYSTEM_PROMPT = `You are a coding agent at ${SANDBOX_ROOT}. Use the todo tool to plan multi-step tasks. Mark in_progress before starting, completed when done. Prefer tools over prose.
意图识别路由结果:
{"complexityLevel":"complex","confidence":0.85,"routeTarget":"agent_loop","judgeFactors":["多步分析","文件读写","跨文件排查"],"tokenCost":0.8,"needThinking":true}
可以进入完整 agent loop，按需使用 todo 和其他工具完成任务。`;

const ESSAY_CONTENT = `# 我想下班

键盘最后一个字符敲下时，屏幕右下角的时间正跳向18:59。咖啡杯底结着深褐色的圈，像我熬红的眼窝。

走廊传来下班打卡机的蜂鸣声，保洁阿姨推着清洁车经过，不锈钢扶手反射着最后一缕夕阳。手机震了震，是妈妈发来的视频邀请，我慌忙把工牌塞进抽屉最深处。

电梯镜面映出我松弛的肩颈，突然想起冰箱里妈妈冻的红烧肉。晚风裹着桂花香扑过来，我把帆布包甩到肩上，听见写字楼的LED屏在喊："该回家了"。

（197字）`;

const IMPROVED_ESSAY = `# 我想下班

键盘落下最后一个字符，屏幕右下角的时间跳向 18:59。咖啡杯底结着一圈深褐色的渍，像熬红的眼窝。

走廊里传来打卡机的蜂鸣，保洁阿姨推着清洁车经过，不锈钢扶手反射出最后一缕夕阳。手机震了一下，是妈妈发来的视频邀请，我慌忙把工牌塞进抽屉最深处。

电梯镜面映出我松弛的肩颈，忽然想起冰箱里妈妈冻的红烧肉。晚风裹着桂花香扑过来，我把帆布包甩到肩上，听见写字楼的 LED 屏在喊："该回家了。"

改进说明：
1. 统一全角/半角标点与数字格式；
2. "正跳向"改为"跳向"，删去冗余副词；
3. 引号末尾补全句号，节奏更稳。`;

const BASH_OUTPUT = `total 24
drwxr-xr-x  5 coder_potato  staff  160  7 10 10:00 .
drwxr-xr-x  8 coder_potato  staff  256  7 10 09:30 ..
-rw-r--r--  1 coder_potato  staff  412  7 10 10:00 temp.txt
-rw-r--r--  1 coder_potato  staff  689  7 10 10:05 temp_improved.txt
-rw-r--r--  1 coder_potato  staff    0  7 10 09:00 .gitkeep`;

export const mockMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
  { role: "system", content: SYSTEM_PROMPT },

  // ===== Round 1：读取短文并分析 =====
  {
    role: "user",
    content: "阅读 data/temp.txt 中的内容，从不同角度分析这篇小短文的优缺点，并给出改进建议",
  },

  {
    role: "assistant",
    content: "",
    tool_calls: [
      {
        id: "call_safe_path_1",
        type: "function",
        function: {
          name: "safe_path",
          arguments: JSON.stringify({
            inputPath: "data/temp.txt",
            sandboxRoot: SANDBOX_ROOT,
          }),
        },
      },
    ],
  },
  {
    role: "tool",
    tool_call_id: "call_safe_path_1",
    content: JSON.stringify(TEMP_FILE),
  },

  {
    role: "assistant",
    content: "",
    tool_calls: [
      {
        id: "call_run_read_1",
        type: "function",
        function: {
          name: "run_read",
          arguments: JSON.stringify({ filePath: TEMP_FILE }),
        },
      },
    ],
  },
  {
    role: "tool",
    tool_call_id: "call_run_read_1",
    content: JSON.stringify({ filePath: TEMP_FILE, content: ESSAY_CONTENT }),
  },

  {
    role: "assistant",
    content: "",
    tool_calls: [
      {
        id: "call_todo_1",
        type: "function",
        function: {
          name: "todo",
          arguments: JSON.stringify({
            items: [
              { content: "分析短文《我想下班》的优点", status: "in_progress", activeForm: "分析优点" },
              { content: "分析短文《我想下班》的缺点", status: "pending", activeForm: "" },
              { content: "给出结构化改进建议", status: "pending", activeForm: "" },
            ],
          }),
        },
      },
    ],
  },
  {
    role: "tool",
    tool_call_id: "call_todo_1",
    content: JSON.stringify({
      items: [
        { content: "分析短文《我想下班》的优点", status: "in_progress", activeForm: "分析优点" },
        { content: "分析短文《我想下班》的缺点", status: "pending", activeForm: "" },
        { content: "给出结构化改进建议", status: "pending", activeForm: "" },
      ],
    }),
  },

  {
    role: "assistant",
    content: `### 小短文《我想下班》分析与改进建议

#### 一、优点
1. **画面感强**：咖啡杯圈、蜂鸣声、夕阳等细节构建了真实的下班场景。
2. **情绪递进**：从疲惫到释然，情绪转换自然。
3. **留白得当**：结尾以 LED 屏"该回家了"收束，余味悠长。

#### 二、缺点
1. **标点不统一**：全角与半角混用（如 18:59 与 LED）。
2. **冗余副词**："正跳向"中的"正"略显多余。
3. **引号收尾**：结尾引号内缺句号，节奏稍欠。

#### 三、改进建议
1. 统一标点与数字格式；
2. 删去冗余副词，动作更干脆；
3. 引号末补句号，收束更稳。`,
  },

  // ===== Round 2：写入改进版 =====
  { role: "user", content: "把改进后的版本写入 data/temp_improved.txt" },

  {
    role: "assistant",
    content: "",
    tool_calls: [
      {
        id: "call_todo_2",
        type: "function",
        function: {
          name: "todo",
          arguments: JSON.stringify({
            items: [
              { content: "分析短文《我想下班》的优点", status: "completed", activeForm: "" },
              { content: "分析短文《我想下班》的缺点", status: "in_progress", activeForm: "" },
              { content: "给出结构化改进建议", status: "pending", activeForm: "" },
            ],
          }),
        },
      },
    ],
  },
  {
    role: "tool",
    tool_call_id: "call_todo_2",
    content: JSON.stringify({
      items: [
        { content: "分析短文《我想下班》的优点", status: "completed", activeForm: "" },
        { content: "分析短文《我想下班》的缺点", status: "completed", activeForm: "" },
        { content: "给出结构化改进建议", status: "completed", activeForm: "" },
      ],
    }),
  },

  {
    role: "assistant",
    content: "",
    tool_calls: [
      {
        id: "call_run_write_1",
        type: "function",
        function: {
          name: "run_write",
          arguments: JSON.stringify({ filePath: IMPROVED_FILE, content: IMPROVED_ESSAY }),
        },
      },
    ],
  },
  {
    role: "tool",
    tool_call_id: "call_run_write_1",
    content: JSON.stringify({ ok: true, path: IMPROVED_FILE, bytes: IMPROVED_ESSAY.length }),
  },

  {
    role: "assistant",
    content:
      "已将改进后的版本写入 `data/temp_improved.txt`（共 689 字节）。改进点已统一标点、删冗余副词、补引号句号。",
  },

  // ===== Round 3：列目录 =====
  { role: "user", content: "看下 data 目录下都有哪些文件" },

  {
    role: "assistant",
    content: "",
    tool_calls: [
      {
        id: "call_run_bash_1",
        type: "function",
        function: {
          name: "run_bash",
          arguments: JSON.stringify({ command: "ls -la data/", cwd: SANDBOX_ROOT }),
        },
      },
    ],
  },
  {
    role: "tool",
    tool_call_id: "call_run_bash_1",
    content: JSON.stringify({ stdout: BASH_OUTPUT, exitCode: 0 }),
  },

  {
    role: "assistant",
    content:
      "## data 目录下共 3 个文件：\n- `temp.txt`（412 字节，原始短文）\n- `temp_improved.txt`（689 字节，改进版）\n- `.gitkeep`（空文件）",
  },
];
