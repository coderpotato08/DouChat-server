/**
 * MicroCompactStage - L2 旧工具结果占位（跨消息）
 *
 * 只保留最近 N 条工具调用记录，更早的 tool 结果 content 替换为占位符；
 * 原文保留在 DB originalContent（不落盘），回滚从 DB 取。详见 compressor-pipeline-design.md 2.1。
 *
 * 状态：📋 空桩占位，待实现（代办 #7）。
 */
export class MicroCompactStage {}
