/**
 * ============================================================
 * 适配器：FileSystemConfigAdapter
 * 描述：将文件系统（fs）适配为 IConfigPort 接口
 * 依赖方向：适配器 → IConfigPort（实现方）
 * ============================================================
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { IConfigPort } from '../../core/ports';
import type { OpenCodeConfig, ConfigSummary } from '../../shared/atoms';
import { deepClone } from '../../server/utils/deepMerge';

/** 文件系统配置适配器构造参数 */
export interface FileSystemConfigAdapterOptions {
  /** opencode.json 路径 */
  configPath: string;
  /** 计算技能数量的函数（由外部注入） */
  countSkills?: () => Promise<number>;
  /** 计算提供商数量的函数（由外部注入） */
  countProviders?: (config: OpenCodeConfig) => Promise<number>;
  /** 计算模型数量的函数（由外部注入） */
  countModels?: (config: OpenCodeConfig) => Promise<number>;
}

/**
 * FileSystemConfigAdapter
 * 适配文件系统 → IConfigPort
 */
export class FileSystemConfigAdapter implements IConfigPort {
  private configPath: string;
  private countSkills?: () => Promise<number>;
  private countProviders?: (config: OpenCodeConfig) => Promise<number>;
  private countModels?: (config: OpenCodeConfig) => Promise<number>;

  constructor(options: FileSystemConfigAdapterOptions) {
    this.configPath = options.configPath;
    this.countSkills = options.countSkills;
    this.countProviders = options.countProviders;
    this.countModels = options.countModels;
  }

  /** 从文件系统读取配置 */
  async read(): Promise<OpenCodeConfig> {
    try {
      const raw = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(raw) as OpenCodeConfig;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }
      if (err instanceof SyntaxError) {
        throw new Error('配置文件 JSON 语法错误');
      }
      throw new Error(`读取配置文件失败: ${(err as Error).message}`);
    }
  }

  /** 写入配置到文件系统 */
  async write(config: OpenCodeConfig): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (err) {
      throw new Error(`保存配置文件失败: ${(err as Error).message}`);
    }
  }

  /** 获取配置摘要 */
  async getSummary(config: OpenCodeConfig): Promise<ConfigSummary> {
    let fileSize = 0;
    let lastModified = '';
    try {
      const stat = await fs.stat(this.configPath);
      fileSize = stat.size;
      lastModified = stat.mtime.toISOString();
    } catch {
      // 文件不存在时使用默认值
    }

    const providerCount = this.countProviders
      ? await this.countProviders(config)
      : (config.provider ? Object.keys(config.provider).length : 0);

    const modelCount = this.countModels
      ? await this.countModels(config)
      : 0;

    const skillCount = this.countSkills ? await this.countSkills() : 0;

    return {
      providerCount,
      modelCount,
      agentCount: config.agent ? Object.keys(config.agent).length : 0,
      mcpCount: config.mcp ? Object.keys(config.mcp).length : 0,
      skillCount,
      toolCount: config.tools ? Object.keys(config.tools).length : 0,
      configSize: fileSize,
      lastModified,
      configPath: this.configPath,
    };
  }

  /** 获取配置文件的文件统计信息 */
  async getFileStats(): Promise<{ size: number; lastModified: string }> {
    try {
      const stat = await fs.stat(this.configPath);
      return { size: stat.size, lastModified: stat.mtime.toISOString() };
    } catch {
      return { size: 0, lastModified: '' };
    }
  }
}
