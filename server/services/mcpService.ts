/**
 * MCP 服务器管理服务
 * 管理 MCP 服务器的 CRUD 操作
 */

import { configService } from './configService';
import { AppError } from '../middleware/errorHandler';
import type { McpLocalConfig, McpRemoteConfig, McpSimpleConfig } from '../types';

type McpConfig = McpLocalConfig | McpRemoteConfig | McpSimpleConfig;

class McpService {
  async list(): Promise<Record<string, McpConfig>> {
    const config = await configService.getConfig();
    return (config.mcp || {}) as Record<string, McpConfig>;
  }

  async add(name: string, mcpConfig: McpConfig): Promise<McpConfig> {
    const config = await configService.getConfig();
    const mcp = config.mcp || {};

    if (mcp[name]) {
      throw new AppError(409, 'DUPLICATE_NAME', `MCP 服务器 "${name}" 已存在`);
    }

    mcp[name] = mcpConfig;
    await configService.updateConfig({ mcp });
    return mcpConfig;
  }

  async update(name: string, mcpConfig: Partial<McpConfig>): Promise<McpConfig> {
    const config = await configService.getConfig();
    const mcp = config.mcp || {};

    if (!mcp[name]) {
      throw new AppError(404, 'FILE_NOT_FOUND', `MCP 服务器 "${name}" 不存在`);
    }

    mcp[name] = { ...(mcp[name] as object), ...mcpConfig } as McpConfig;
    await configService.updateConfig({ mcp });
    return mcp[name];
  }

  async delete(name: string): Promise<void> {
    const config = await configService.getConfig();
    const mcp = config.mcp || {};

    if (!mcp[name]) {
      throw new AppError(404, 'FILE_NOT_FOUND', `MCP 服务器 "${name}" 不存在`);
    }

    delete mcp[name];
    await configService.updateConfig({ mcp });
  }
}

export const mcpService = new McpService();
