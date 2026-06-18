/**
 * 配置读写引擎（核心服务）
 * 负责 opencode.json 的读取、写入、验证、导出和导入
 */

import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { getConfigPath, getBackupsDir } from '../utils/paths';
import { deepMerge, deepClone } from '../utils/deepMerge';
import { AppError } from '../middleware/errorHandler';
import type {
  OpenCodeConfig,
  ConfigSummary,
  ApiResponse,
  BackupInfo,
} from '../types';

class ConfigService {
  private cachedConfig: OpenCodeConfig | null = null;
  private configPath: string;

  constructor() {
    this.configPath = getConfigPath();
  }

  // ============================================================
  // 1.1 load() — 从文件系统读取并解析 opencode.json
  // ============================================================
  async load(): Promise<OpenCodeConfig> {
    try {
      const raw = await fsPromises.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(raw) as OpenCodeConfig;
      this.cachedConfig = config;
      return config;
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new AppError(422, 'CONFIG_PARSE_ERROR', '配置文件 JSON 语法错误');
      }
      // 文件不存在时返回空配置
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        const emptyConfig: OpenCodeConfig = {};
        this.cachedConfig = emptyConfig;
        return emptyConfig;
      }
      throw new AppError(500, 'OPERATION_FAILED', `读取配置文件失败: ${(err as Error).message}`);
    }
  }

  // ============================================================
  // 1.2 save() — 验证后写入 opencode.json
  // ============================================================
  async save(config: OpenCodeConfig): Promise<void> {
    // 写入前自动创建备份
    await this.createBackup();

    try {
      // 确保目录存在
      await fsPromises.mkdir(path.dirname(this.configPath), { recursive: true });
      // 美化写入
      await fsPromises.writeFile(
        this.configPath,
        JSON.stringify(config, null, 2),
        'utf-8',
      );
      this.cachedConfig = config;
    } catch (err) {
      throw new AppError(500, 'OPERATION_FAILED', `保存配置文件失败: ${(err as Error).message}`);
    }
  }

  // ============================================================
  // 1.3 getConfig() — 返回完整配置对象
  // ============================================================
  async getConfig(): Promise<OpenCodeConfig> {
    if (this.cachedConfig) {
      return deepClone(this.cachedConfig);
    }
    return await this.load();
  }

  // ============================================================
  // 1.4 updateConfig() — 部分更新配置（深度合并）
  // ============================================================
  async updateConfig(partial: Partial<OpenCodeConfig>): Promise<OpenCodeConfig> {
    const current = await this.getConfig();
    const merged = deepMerge(current as Record<string, unknown>, partial as Record<string, unknown>) as OpenCodeConfig;
    await this.save(merged);
    return deepClone(merged);
  }

  // ============================================================
  // 1.5 replaceConfig() — 全量替换配置
  // ============================================================
  async replaceConfig(config: OpenCodeConfig): Promise<OpenCodeConfig> {
    await this.save(config);
    return deepClone(config);
  }

  // ============================================================
  // 1.6 validate() — 配置验证
  // ============================================================
  validate(config: OpenCodeConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证模型格式 (provider/model)
    if (config.model && !/^[\w-]+\/[\w.-]+$/.test(config.model)) {
      errors.push('默认模型格式不正确，应为 "提供商/模型名" 格式');
    }
    if (config.small_model && !/^[\w-]+\/[\w.-]+$/.test(config.small_model)) {
      errors.push('小模型格式不正确，应为 "提供商/模型名" 格式');
    }

    // 验证 logLevel
    if (config.logLevel && !['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(config.logLevel)) {
      errors.push('logLevel 取值必须为 DEBUG、INFO、WARN 或 ERROR');
    }

    // 验证提供商配置
    if (config.provider) {
      for (const [name, provider] of Object.entries(config.provider)) {
        if (provider.options?.baseURL) {
          try {
            new URL(provider.options.baseURL);
          } catch {
            errors.push(`提供商 "${name}" 的 baseURL 格式不正确`);
          }
        }
      }
    }

    // 验证代理配置
    if (config.agent) {
      for (const [name, agent] of Object.entries(config.agent)) {
        if (agent.model && !/^[\w-]+\/[\w.-]+$/.test(agent.model)) {
          errors.push(`代理 "${name}" 的模型格式不正确`);
        }
        if (agent.temperature !== undefined && (agent.temperature < 0 || agent.temperature > 2)) {
          errors.push(`代理 "${name}" 的 temperature 取值范围为 0-2`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ============================================================
  // 1.7 exportConfig() — 导出全部配置
  // ============================================================
  async exportConfig(): Promise<{ config: OpenCodeConfig; exportedAt: string }> {
    const config = await this.getConfig();
    return {
      config,
      exportedAt: new Date().toISOString(),
    };
  }

  // ============================================================
  // 1.8 importConfig() — 从 JSON 恢复配置
  // ============================================================
  async importConfig(config: OpenCodeConfig): Promise<OpenCodeConfig> {
    // 先验证
    const { valid, errors } = this.validate(config);
    if (!valid) {
      throw new AppError(422, 'VALIDATION_ERROR', errors.join('；'));
    }
    return await this.replaceConfig(config);
  }

  // ============================================================
  // 1.9 getSummary() — 计算配置统计信息
  // ============================================================
  async getSummary(): Promise<ConfigSummary> {
    const config = await this.getConfig();

    let modelCount = 0;
    if (config.provider) {
      for (const provider of Object.values(config.provider)) {
        if (provider.models) {
          modelCount += Object.keys(provider.models).length;
        }
      }
    }

    let fileSize = 0;
    let lastModified = '';
    try {
      const stat = await fsPromises.stat(this.configPath);
      fileSize = stat.size;
      lastModified = stat.mtime.toISOString();
    } catch {
      // 文件不存在时使用默认值
    }

    return {
      providerCount: config.provider ? Object.keys(config.provider).length : 0,
      modelCount,
      agentCount: config.agent ? Object.keys(config.agent).length : 0,
      mcpCount: config.mcp ? Object.keys(config.mcp).length : 0,
      skillCount: 0, // 技能需要额外扫描 skills/ 目录
      toolCount: config.tools ? Object.keys(config.tools).length : 0,
      configSize: fileSize,
      lastModified,
      configPath: this.configPath,
    };
  }

  // ============================================================
  // 内部方法：创建备份
  // ============================================================
  private async createBackup(): Promise<void> {
    try {
      const raw = await fsPromises.readFile(this.configPath, 'utf-8');
      const backupsDir = getBackupsDir();
      await fsPromises.mkdir(backupsDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupsDir, `opencode-${timestamp}.json`);
      await fsPromises.writeFile(backupPath, raw, 'utf-8');

      // 清理旧备份（保留最近 10 份）
      await this.cleanOldBackups(backupsDir, 10);
    } catch (err) {
      // 如果文件不存在（首次写入），跳过备份
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('创建备份失败:', (err as Error).message);
      }
    }
  }

  /**
   * 清理旧备份，只保留最近的 N 份
   */
  private async cleanOldBackups(dir: string, keep: number): Promise<void> {
    try {
      const files = await fsPromises.readdir(dir);
      const backupFiles = files
        .filter(f => f.startsWith('opencode-') && f.endsWith('.json'))
        .map(f => ({ name: f, time: fs.statSync(path.join(dir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time);

      if (backupFiles.length > keep) {
        for (const file of backupFiles.slice(keep)) {
          await fsPromises.unlink(path.join(dir, file.name));
        }
      }
    } catch {
      // 目录不存在时忽略
    }
  }

  // ============================================================
  // 备份管理 API
  // ============================================================

  /** 列出所有备份 */
  async listBackups(): Promise<BackupInfo[]> {
    const backupsDir = getBackupsDir();
    try {
      const files = await fsPromises.readdir(backupsDir);
      const backups: BackupInfo[] = [];

      for (const file of files) {
        if (!file.startsWith('opencode-') || !file.endsWith('.json')) continue;
        const filePath = path.join(backupsDir, file);
        try {
          const stat = await fsPromises.stat(filePath);
          backups.push({
            id: file.replace('.json', '').replace('opencode-', ''),
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
    } catch {
      return [];
    }
  }

  /** 获取单个备份内容 */
  async getBackup(backupId: string): Promise<OpenCodeConfig> {
    const backupsDir = getBackupsDir();
    const backupPath = path.join(backupsDir, `opencode-${backupId}.json`);
    try {
      const raw = await fsPromises.readFile(backupPath, 'utf-8');
      return JSON.parse(raw) as OpenCodeConfig;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new AppError(404, 'FILE_NOT_FOUND', '备份文件不存在');
      }
      if (err instanceof SyntaxError) {
        throw new AppError(422, 'CONFIG_PARSE_ERROR', '备份文件 JSON 语法错误');
      }
      throw new AppError(500, 'OPERATION_FAILED', `读取备份失败: ${(err as Error).message}`);
    }
  }

  /** 恢复备份 */
  async restoreBackup(backupId: string): Promise<OpenCodeConfig> {
    const backupsDir = getBackupsDir();
    const backupPath = path.join(backupsDir, `opencode-${backupId}.json`);

    try {
      const raw = await fsPromises.readFile(backupPath, 'utf-8');
      const config = JSON.parse(raw) as OpenCodeConfig;
      await this.save(config);
      return deepClone(config);
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new AppError(422, 'CONFIG_PARSE_ERROR', '备份文件 JSON 语法错误');
      }
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new AppError(404, 'FILE_NOT_FOUND', '备份文件不存在');
      }
      throw new AppError(500, 'OPERATION_FAILED', `恢复备份失败: ${(err as Error).message}`);
    }
  }

  /** 删除备份 */
  async deleteBackup(backupId: string): Promise<void> {
    const backupsDir = getBackupsDir();
    const backupPath = path.join(backupsDir, `opencode-${backupId}.json`);

    try {
      await fsPromises.unlink(backupPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new AppError(404, 'FILE_NOT_FOUND', '备份文件不存在');
      }
      throw new AppError(500, 'OPERATION_FAILED', `删除备份失败: ${(err as Error).message}`);
    }
  }
}

// 导出单例
export const configService = new ConfigService();
