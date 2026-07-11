import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

/**
 * DiskPersistenceStore - 磁盘持久化存储
 *
 * 服务于两类落盘需求：
 * 1. L3 ToolResultBudget：单个工具结果写为 JSON 文件，消息 content 替换为占位符，
 *    compressMeta 记录返回的相对路径；回滚时按路径读取还原。
 * 2. autoCompact / L1 snipCompact：被摘要替换或被裁剪的完整消息追加到
 *    .transcript/<sessionId>.jsonl，供历史追回。
 *
 * 目录布局（rootDir 下）：
 *   tool-results/<sessionId>/<toolCallId>.json
 *   .transcript/<sessionId>.jsonl
 *
 * 安全：sessionId / toolCallId 仅允许 [A-Za-z0-9_-]；读取路径必须落在 rootDir 内，
 * 防止目录穿越。
 *
 * 详见 docs/plan/conversation-store-v2/compressor-pipeline-design.md 2.1(L3) / 2.2。
 */
const TOOL_RESULTS_DIR = "tool-results";
const TRANSCRIPT_DIR = ".transcript";
const SAFE_PATH_SEGMENT = /^[a-zA-Z0-9_-]+$/;

export class DiskPersistenceStore {
  private readonly rootDir: string;

  constructor(rootDir?: string) {
    this.rootDir = resolve(
      rootDir ?? join(process.cwd(), ".douchat-compress"),
    );
  }

  /**
   * L3：写入工具结果到磁盘。
   * @returns 相对 rootDir 的路径（如 `tool-results/<sessionId>/<toolCallId>.json`），
   *          供 compressMeta 记录，readToolResult 据此读取。
   */
  async writeToolResult(
    sessionId: string,
    toolCallId: string,
    data: unknown,
  ): Promise<string> {
    this.assertSafeSegment(sessionId, "sessionId");
    this.assertSafeSegment(toolCallId, "toolCallId");
    const relPath = join(TOOL_RESULTS_DIR, sessionId, `${toolCallId}.json`);
    const absPath = join(this.rootDir, relPath);
    await mkdir(dirname(absPath), { recursive: true });
    await writeFile(absPath, JSON.stringify(data), "utf-8");
    return relPath;
  }

  /**
   * L3：按 writeToolResult 返回的路径读取工具结果原文。
   * 接受相对 rootDir 的路径或绝对路径（须落在 rootDir 内）。
   */
  async readToolResult(filePath: string): Promise<unknown> {
    const absPath = this.resolveWithinRoot(filePath);
    const raw = await readFile(absPath, "utf-8");
    return JSON.parse(raw);
  }

  /**
   * autoCompact / L1：追加消息记录到会话 transcript JSONL。
   * 每条 entry 序列化为一行；空数组为 no-op。
   */
  async appendTranscript(
    sessionId: string,
    entries: ReadonlyArray<unknown>,
  ): Promise<void> {
    if (entries.length === 0) return;
    this.assertSafeSegment(sessionId, "sessionId");
    const absPath = join(this.rootDir, TRANSCRIPT_DIR, `${sessionId}.jsonl`);
    await mkdir(dirname(absPath), { recursive: true });
    const lines = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
    await appendFile(absPath, lines, "utf-8");
  }

  /**
   * 历史追回：读取会话 transcript 全量记录（文件不存在时返回空数组）。
   */
  async readTranscript(sessionId: string): Promise<unknown[]> {
    this.assertSafeSegment(sessionId, "sessionId");
    const absPath = join(this.rootDir, TRANSCRIPT_DIR, `${sessionId}.jsonl`);
    let raw: string;
    try {
      raw = await readFile(absPath, "utf-8");
    } catch (err) {
      if (isENOENT(err)) return [];
      throw err;
    }
    return raw
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
  }

  // ==================== 内部辅助 ====================

  private assertSafeSegment(segment: string, label: string): void {
    if (!SAFE_PATH_SEGMENT.test(segment)) {
      throw new Error(`Invalid ${label} for disk persistence: ${segment}`);
    }
  }

  /** 解析为 rootDir 内的绝对路径，越界抛错（防目录穿越） */
  private resolveWithinRoot(filePath: string): string {
    const absPath = isAbsolute(filePath)
      ? filePath
      : join(this.rootDir, filePath);
    const resolved = resolve(absPath);
    const rel = relative(this.rootDir, resolved);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      throw new Error(`Path escapes disk persistence root: ${filePath}`);
    }
    return resolved;
  }
}

/** 判定 fs 错误是否为文件不存在（ENOENT） */
function isENOENT(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as NodeJS.ErrnoException).code === "ENOENT"
  );
}
