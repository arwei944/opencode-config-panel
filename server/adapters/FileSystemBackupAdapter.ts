/**
 * ============================================================
 * 适配器：FileSystemBackupAdapter
 * 描述：将文件系统（fs）适配为 IBackupPort 接口
 * 依赖方向：适配器 → IBackupPort（实现方）
 * ============================================================
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync, statSync } from 'node:fs';
import type { IBackupPort } from '../../core/ports';
import type { BackupInfo, OpenCodeConfig } from '../../shared/atoms';

/** 文件系统备份适配器构造参数 */
export interface FileSystemBackupAdapterOptions {
  /** backups 目录路径 */
  backupsDir: string;
  /** 配置源文件路径（用于制作备份副本） */
  configPath: string;
}

/**
 * FileSystemBackupAdapter
 * 适配文件系统 → IBackupPort
 */
export class FileSystemBackupAdapter implements IBackupPort {
  private backupsDir: string;
  private configPath: string;

  constructor(options: FileSystemBackupAdapterOptions) {
    this.backupsDir = options.backupsDir;
    this.configPath = options.configPath;
  }

  /** 创建备份 */
  async create(config: OpenCodeConfig): Promise<BackupInfo> {
    await fs.mkdir(this.backupsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupsDir, `opencode-${timestamp}.json`);

    // 将当前配置写入备份文件
    await fs.writeFile(backupPath, JSON.stringify(config, null, 2), 'utf-8');

    const stat = await fs.stat(backupPath);
    const backupId = timestamp;

    return {
      id: backupId,
      filename: `opencode-${timestamp}.json`,
      timestamp: stat.mtime.toISOString(),
      size: stat.size,
      path: backupPath,
    };
  }

  /** 列出所有备份 */
  async list(): Promise<BackupInfo[]> {
    try {
      await fs.access(this.backupsDir);
    } catch {
      return [];
    }

    const files = await fs.readdir(this.backupsDir);
    const backups: BackupInfo[] = [];

    for (const file of files) {
      const match = file.match(/^opencode-(.+)\.json$/);
      if (!match) continue;

      const filePath = path.join(this.backupsDir, file);
      try {
        const stat = await fs.stat(filePath);
        backups.push({
          id: match[1],
          filename: file,
          timestamp: stat.mtime.toISOString(),
          size: stat.size,
          path: filePath,
        });
      } catch {
        // 跳过无法访问的文件
      }
    }

    // 按时间降序排列
    return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /** 读取指定备份 */
  async read(backupId: string): Promise<OpenCodeConfig> {
    const backupPath = path.join(this.backupsDir, `opencode-${backupId}.json`);

    try {
      const raw = await fs.readFile(backupPath, 'utf-8');
      return JSON.parse(raw) as OpenCodeConfig;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error('备份文件不存在');
      }
      if (err instanceof SyntaxError) {
        throw new Error('备份文件 JSON 语法错误');
      }
      throw new Error(`读取备份失败: ${(err as Error).message}`);
    }
  }

  /** 删除指定备份 */
  async delete(backupId: string): Promise<void> {
    const backupPath = path.join(this.backupsDir, `opencode-${backupId}.json`);

    try {
      await fs.unlink(backupPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error('备份文件不存在');
      }
      throw new Error(`删除备份失败: ${(err as Error).message}`);
    }
  }

  /** 清理旧备份，保留最近 N 份 */
  async clean(maxKeep: number): Promise<void> {
    try {
      const files = await fs.readdir(this.backupsDir);
      const backupFiles = files
        .filter(f => f.startsWith('opencode-') && f.endsWith('.json'))
        .map(f => ({ name: f, time: statSync(path.join(this.backupsDir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time);

      if (backupFiles.length > maxKeep) {
        for (const file of backupFiles.slice(maxKeep)) {
          await fs.unlink(path.join(this.backupsDir, file.name));
        }
      }
    } catch {
      // 目录不存在时忽略
    }
  }
}
