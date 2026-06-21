/**
 * ============================================================
 * 端口层统一导出
 * 所有 Port 接口从此文件导出
 * 约束：端口仅定义契约，不包含实现
 * ============================================================
 */

export type { IConfigPort } from './IConfigPort';
export type { IBackupPort } from './IBackupPort';
export type { IValidationPort, ValidationResult } from './IValidationPort';
export type { IFileSystemPort, DirEntry } from './IFileSystemPort';
export type { IConnectionTestPort } from './IConnectionTestPort';
