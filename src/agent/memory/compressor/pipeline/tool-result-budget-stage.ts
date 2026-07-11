/**
 * ToolResultBudgetStage - L3 大结果落盘（跨消息 + 磁盘）
 *
 * 工具结果总量超阈值时，从占用上下文最大的结果开始，content 替换为 <persisted-result> 占位符，
 * 实际结果落盘到磁盘目录，compressMeta 记录文件路径；回滚从磁盘读取还原。详见 compressor-pipeline-design.md 2.1。
 *
 * 状态：📋 空桩占位，待实现（代办 #7）。
 */
export class ToolResultBudgetStage {}
