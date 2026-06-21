/**
 * Mock: IConfigPort
 * 用于单元测试的配置端口模拟实现
 */

import type { IConfigPort } from '../../core/ports';
import type { OpenCodeConfig, ConfigSummary } from '../../shared/atoms';
import { deepClone } from '../../shared/utils/deepMerge';

export class MockConfigPort implements IConfigPort {
  private data: OpenCodeConfig;

  constructor(initial: Partial<OpenCodeConfig> = {}) {
    this.data = deepClone(initial) as OpenCodeConfig;
  }

  async read(): Promise<OpenCodeConfig> {
    return deepClone(this.data) as OpenCodeConfig;
  }

  async write(config: OpenCodeConfig): Promise<void> {
    this.data = deepClone(config) as OpenCodeConfig;
  }

  async getSummary(config: OpenCodeConfig): Promise<ConfigSummary> {
    return {
      providerCount: config.provider ? Object.keys(config.provider).length : 0,
      modelCount: 0,
      agentCount: config.agent ? Object.keys(config.agent).length : 0,
      mcpCount: config.mcp ? Object.keys(config.mcp).length : 0,
      skillCount: 0,
      toolCount: config.tools ? Object.keys(config.tools).length : 0,
      configSize: 0,
      lastModified: '',
      configPath: '/mock/opencode.json',
    };
  }

  async getFileStats(): Promise<{ size: number; lastModified: string }> {
    return { size: 100, lastModified: new Date().toISOString() };
  }

  /** 获取当前数据（用于断言） */
  getData(): OpenCodeConfig {
    return deepClone(this.data) as OpenCodeConfig;
  }

  /** 设置初始数据 */
  setData(data: Partial<OpenCodeConfig>): void {
    this.data = deepClone(data) as OpenCodeConfig;
  }
}
