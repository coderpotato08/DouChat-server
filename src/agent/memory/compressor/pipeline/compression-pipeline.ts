/**
 * CompressionPipeline - 每轮自动压缩管线编排器
 *
 * 串联 L1 snipCompact -> L2 microCompact -> L3 ToolResultBudget 三层阶段顺序执行，
 * 各层内部按阈值决定是否动作。
 * 详见 docs/plan/conversation-store-v2/compressor-pipeline-design.md 第五章。
 *
 * 状态：📋 空桩占位，待实现（代办 #7）。
 */
export class CompressionPipeline {}
