/**
 * AutoCompactStrategy - 条件触发 LLM 摘要压缩
 *
 * L1-L3 管线跑完后上下文仍超阈值时触发：旧对话记录通过 LLM 压缩成摘要替换原内容，
 * 完整对话落入 .transcript/ JSONL 方便历史追回，生成快照归档到 ai_chat_compress_snapshots。
 * 详见 compressor-pipeline-design.md 2.2。
 *
 * 状态：📋 空桩占位，待实现（代办 #7）。
 */
export class AutoCompactStrategy {}
