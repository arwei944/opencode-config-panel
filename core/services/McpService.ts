/**
 * ============================================================
 * 服务：McpService
 * 描述：MCP 服务器管理核心服务 — 纯业务逻辑
 * 依赖：IConfigPort（配置读写）
 * 约束：仅通过 Port 接口与外部交互
 * ============================================================
 */

import type { IConfigPort } from '../ports';
import type { McpConfig } from '../../shared/atoms';

/** MCP 服务构造参数 */
export interface McpServiceOptions {
  configPort: IConfigPort;
}

/**
 * McpService — MCP 服务器管理核心服务
 */
export class McpService {
  private configPort: IConfigPort;

  constructor(options: McpServiceOptions) {
    this.configPort = options.configPort;
  }

  /** 获取所有 MCP 服务器 */
  async list(): Promise<Record<string, McpConfig>> {
    const config = await this.configPort.read();
    return (config.mcp || {}) as Record<string, McpConfig>;
  }

  /** 添加 MCP 服务器 */
  async add(name: string, mcpConfig: McpConfig): Promise<McpConfig> {
    const config = await this.configPort.read();
    const mcp = config.mcp || {};

    if (mcp[name]) {
      throw new Error(`MCP 服务器 "${name}" 已存在`);
    }

    mcp[name] = mcpConfig;
    await this.configPort.write({ ...config, mcp });
    return mcpConfig;
  }

  /** 更新 MCP 服务器 */
  async update(name: string, mcpConfig: Partial<McpConfig>): Promise<McpConfig> {
    const config = await this.configPort.read();
    const mcp = config.mcp || {};

    if (!mcp[name]) {
      throw new Error(`MCP 服务器 "${name}" 不存在`);
    }

    mcp[name] = { ...(mcp[name] as object), ...mcpConfig } as McpConfig;
    await this.configPort.write({ ...config, mcp });
    return mcp[name];
  }

  /** 删除 MCP 服务器 */
  async delete(name: string): Promise<void> {
    const config = await this.configPort.read();
    const mcp = config.mcp || {};

    if (!mcp[name]) {
      throw new Error(`MCP 服务器 "${name}" 不存在`);
    }

    delete mcp[name];
    await this.configPort.write({ ...config, mcp });
  }
}
