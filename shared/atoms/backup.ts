/**
 * ============================================================
 * 原子：Backup
 * 描述：备份相关类型定义（最小不可变单元）
 * 约束：本原子不可修改，所有变更应通过 Port 接口进行
 * ============================================================
 */

/** 备份信息原子 */
export interface BackupInfo {
  id: string;
  filename: string;
  timestamp: string;
  size: number;
  path: string;
}

/** 备份创建结果原子 */
export interface BackupCreateResult {
  backupId: string;
  path: string;
  timestamp: string;
}

/** 备份过滤选项原子 */
export interface BackupFilterOptions {
  /** 最大保留份数 */
  maxKeep?: number;
  /** 起始时间过滤 */
  since?: string;
}
