/**
 * ============================================================
 * Port：IBackupPort
 * 描述：备份持久化端口 — 定义备份管理的契约接口
 * 依赖方向：服务层 → 本端口（单向依赖）
 * 实现方：适配器层
 * ============================================================
 */

import type { BackupInfo, OpenCodeConfig } from '../../shared/atoms';

/** 备份端口接口 */
export interface IBackupPort {
  /** 创建配置备份 */
  create(config: OpenCodeConfig): Promise<BackupInfo>;

  /** 列出所有备份 */
  list(): Promise<BackupInfo[]>;

  /** 读取指定备份的配置内容 */
  read(backupId: string): Promise<OpenCodeConfig>;

  /** 删除指定备份 */
  delete(backupId: string): Promise<void>;

  /** 清理旧备份，保留最近 N 份 */
  clean(maxKeep: number): Promise<void>;
}
