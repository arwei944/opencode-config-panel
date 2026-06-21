/**
 * ============================================================
 * 服务：ConfigService
 * 描述：配置管理核心服务 — 纯业务逻辑，不依赖任何框架
 * 依赖：IConfigPort（配置读写）、IBackupPort（备份）、IValidationPort（验证）
 * 约束：仅通过 Port 接口与外部交互，不直接调用文件系统或框架 API
 * ============================================================
 */

import type { IConfigPort, IBackupPort, IValidationPort } from '../ports';
import type { OpenCodeConfig, ConfigSummary, BackupInfo } from '../../shared/atoms';
import { deepMerge, deepClone } from '../../shared/utils/deepMerge';

/** 配置服务构造参数 */
export interface ConfigServiceOptions {
  configPort: IConfigPort;
  backupPort: IBackupPort;
  validationPort: IValidationPort;
  /** 写入前是否自动创建备份（默认 true） */
  autoBackup?: boolean;
  /** 最大保留备份份数（默认 10） */
  maxBackups?: number;
}

/**
 * ConfigService — 配置管理核心服务
 *
 * 原子不可变：本服务不修改传入的配置对象，始终返回深拷贝
 * 端口隔离：所有外部 IO 经由 Port 接口
 */
export class ConfigService {
  private configPort: IConfigPort;
  private backupPort: IBackupPort;
  private validationPort: IValidationPort;
  private autoBackup: boolean;
  private maxBackups: number;
  private cachedConfig: OpenCodeConfig | null = null;
  private loadPromise: Promise<OpenCodeConfig> | null = null;

  constructor(options: ConfigServiceOptions) {
    this.configPort = options.configPort;
    this.backupPort = options.backupPort;
    this.validationPort = options.validationPort;
    this.autoBackup = options.autoBackup ?? true;
    this.maxBackups = options.maxBackups ?? 10;
  }

  /** 获取完整配置（带缓存和并发锁） */
  async getConfig(): Promise<OpenCodeConfig> {
    if (this.cachedConfig) {
      return deepClone(this.cachedConfig);
    }
    if (this.loadPromise) {
      return deepClone(await this.loadPromise);
    }
    this.loadPromise = this.load();
    try {
      return deepClone(await this.loadPromise);
    } finally {
      this.loadPromise = null;
    }
  }

  /** 从端口加载配置 */
  private async load(): Promise<OpenCodeConfig> {
    const config = await this.configPort.read();
    this.cachedConfig = config;
    return config;
  }

  /** 保存配置（带自动备份） */
  async save(config: OpenCodeConfig): Promise<void> {
    if (this.autoBackup) {
      try {
        await this.backupPort.create(config);
        await this.backupPort.clean(this.maxBackups);
      } catch (err) {
        console.error('备份创建失败:', (err as Error).message);
      }
    }
    await this.configPort.write(config);
    this.cachedConfig = deepClone(config);
  }

  /** 部分更新配置（深度合并） */
  async updateConfig(partial: Partial<OpenCodeConfig>): Promise<OpenCodeConfig> {
    const current = await this.getConfig();
    const merged = deepMerge(
      current as Record<string, unknown>,
      partial as Record<string, unknown>,
    ) as OpenCodeConfig;
    await this.save(merged);
    return deepClone(merged);
  }

  /** 全量替换配置 */
  async replaceConfig(config: OpenCodeConfig): Promise<OpenCodeConfig> {
    await this.save(config);
    return deepClone(config);
  }

  /** 验证配置 */
  validate(config: OpenCodeConfig): { valid: boolean; errors: string[] } {
    return this.validationPort.validate(config);
  }

  /** 导出配置 */
  async exportConfig(): Promise<{ config: OpenCodeConfig; exportedAt: string }> {
    const config = await this.getConfig();
    return { config, exportedAt: new Date().toISOString() };
  }

  /** 导入配置（验证后替换） */
  async importConfig(config: OpenCodeConfig): Promise<OpenCodeConfig> {
    const { valid, errors } = this.validationPort.validate(config);
    if (!valid) {
      throw new Error(`配置验证失败：${errors.join('；')}`);
    }
    return this.replaceConfig(config);
  }

  /** 获取配置摘要 */
  async getSummary(): Promise<ConfigSummary> {
    const config = await this.getConfig();
    return this.configPort.getSummary(config);
  }

  // ============================================================
  // 备份管理（委托给 BackupPort）
  // ============================================================

  async listBackups(): Promise<BackupInfo[]> {
    return this.backupPort.list();
  }

  async getBackup(backupId: string): Promise<OpenCodeConfig> {
    return this.backupPort.read(backupId);
  }

  async restoreBackup(backupId: string): Promise<OpenCodeConfig> {
    const config = await this.backupPort.read(backupId);
    await this.save(config);
    return deepClone(config);
  }

  async deleteBackup(backupId: string): Promise<void> {
    return this.backupPort.delete(backupId);
  }

  async createBackupManually(): Promise<BackupInfo> {
    const config = await this.getConfig();
    return this.backupPort.create(config);
  }

  /** 清除缓存（强制下次读取重新加载） */
  clearCache(): void {
    this.cachedConfig = null;
  }
}
