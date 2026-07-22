import { randomBytes } from "node:crypto";

/**
 * ID 类型：区分不同业务场景的唯一标识生成
 */
export type IdType = "session" | "request" | "message" | "compress_snapshot" | "tool_call" | "task";

/**
 * IdGenerator — 全局有序 ID 生成器
 *
 * 基于 UUIDv7（RFC 9562）生成时序有序 ID，便于数据库索引排序优化。
 * UUIDv7 结构：48-bit Unix 时间戳(ms) + 4-bit 版本号(0x7) + 12-bit rand_a
 *            + 2-bit 变体(0b10) + 62-bit rand_b
 */
export class IdGenerator {
  /**
   * 生成一个 UUIDv7 格式的唯一标识
   * @param _type 业务场景类型（当前仅做标记用途，不改变生成逻辑）
   * @returns UUIDv7 字符串，格式: xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx
   */
  static generate(_type: IdType): string {
    const timestamp = Date.now();
    const buf = Buffer.alloc(16);

    // Bytes 0-5: 48-bit Unix timestamp (ms) in big-endian
    buf.writeUInt16BE(Math.floor(timestamp / 0x100000000), 0);
    buf.writeUInt32BE(timestamp % 0x100000000, 2);

    // Bytes 6-15: random
    const rand = randomBytes(10);
    rand.copy(buf, 6);

    // Byte 6: set version to 0x7 (top 4 bits)
    buf[6] = (buf[6] & 0x0f) | 0x70;

    // Byte 8: set variant to 0b10 (top 2 bits)
    buf[8] = (buf[8] & 0x3f) | 0x80;

    // Format as UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const hex = buf.toString("hex");
    return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}`;
  }
}
