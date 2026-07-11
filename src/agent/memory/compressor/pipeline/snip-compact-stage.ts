/**
 * SnipCompactStage - L1 对话裁剪（会话级）
 *
 * 对话轮数超阈值（如 50）时截取中间，保留头部 3 条（初始目标）+ 尾部 n-3 条（当前任务）；
 * 按 requestId / tool_call_id 边界裁剪，不拆开 assistant 与其后紧跟的 user / tool_result；
 * 被裁剪段落落入 .transcript/ JSONL 留档。详见 compressor-pipeline-design.md 2.1。
 *
 * 状态：📋 空桩占位，待实现（代办 #7）。
 */
export class SnipCompactStage {}
