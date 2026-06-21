/**
 * Mock: IBackupPort
 * 用于单元测试的备份端口模拟实现
 */

import type { IBackupPort } from '../../core/ports';
import type { BackupInfo, OpenCodeConfig } from '../../shared/atoms';

export class MockBackupPort implements IBackupPort {
  private backups: Map<string, OpenCodeConfig> = new Map();

  async create(config: OpenCodeConfig): Promise<BackupInfo> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const id = `backup-${timestamp}`;
    this.backups.set(id, JSON.parse(JSON.stringify(config)));
    return {
      id,
      createdAt: new Date().toISOString(),
      size: Buffer.byteLength(JSON.stringify(config)),
    };
  }

  async list(): Promise<BackupInfo[]> {
    return Array.from(this.backups.entries()).map(([id]) => ({
      id,
      createdAt: new Date().toISOString(),
      size: 100,
    }));
  }

  async read(backupId: string): Promise<OpenCodeConfig> {
    const backup = this.backups.get(backupId);
    if (!backup) throw new Error(`备份 "${backupId}" 不存在`);
    return JSON.parse(JSON.stringify(backup));
  }

  async delete(backupId: string): Promise<void> {
    if (!this.backups.has(backupId)) throw new Error(`备份 "${backupId}" 不存在`);
    this.backups.delete(backupId);
  }

  async clean(maxKeep: number): Promise<void> {
    const keys = Array.from(this.backups.keys()).sort();
    while (keys.length > maxKeep) {
      const old = keys.shift();
      if (old) this.backups.delete(old);
    }
  }

  /** 获取备份数量（用于断言） */
  getCount(): number {
    return this.backups.size;
  }
}
