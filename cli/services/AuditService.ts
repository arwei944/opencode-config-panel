/**
 * ============================================================
 * 服务：AuditService
 * 描述：集中式审计日志服务
 * 存储：~/logs/audit.log（JSONL 格式，每行一条 JSON 记录）
 * 记录格式：{ time: string, action: string, detail: object }
 * ============================================================
 */

import type { IFileSystemPort } from '../../core/ports';

export interface AuditEntry {
  time: string;
  action: string;
  detail: Record<string, unknown>;
}

export class AuditService {
  private fs: IFileSystemPort;
  private logsDir: string;
  private logPath: string;

  constructor(opts: { fs: IFileSystemPort; logsDir: string }) {
    this.fs = opts.fs;
    this.logsDir = opts.logsDir;
    this.logPath = opts.logsDir + '/audit.log';
  }

  /** 追加一条审计记录 */
  async append(action: string, detail: Record<string, unknown>): Promise<void> {
    const entry: AuditEntry = {
      time: new Date().toISOString(),
      action,
      detail,
    };
    await this.fs.ensureDir(this.logsDir);
    // 追加一行 JSONL
    const existing = await this.readAllRaw();
    existing.push(entry);
    const lines = existing.map(e => JSON.stringify(e));
    await this.fs.writeFile(this.logPath, lines.join('\n') + '\n');
  }

  /** 返回最近 N 条记录 */
  async tail(n: number): Promise<AuditEntry[]> {
    const all = await this.readAll();
    return all.slice(-n);
  }

  /** 清空审计日志 */
  async clear(): Promise<void> {
    await this.fs.writeFile(this.logPath, '');
  }

  /** 读取全部记录 */
  async readAll(): Promise<AuditEntry[]> {
    try {
      const raw = await this.fs.readFile(this.logPath);
      return raw.trim().split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => {
          try { return JSON.parse(line) as AuditEntry; } catch { return null; }
        })
        .filter((e): e is AuditEntry => e !== null);
    } catch {
      return [];
    }
  }

  /** 读取全部原始字符串行 */
  private async readAllRaw(): Promise<AuditEntry[]> {
    try {
      const raw = await this.fs.readFile(this.logPath);
      return raw.trim().split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => {
          try { return JSON.parse(line) as AuditEntry; } catch { return null; }
        })
        .filter((e): e is AuditEntry => e !== null);
    } catch {
      return [];
    }
  }
}
