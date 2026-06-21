/**
 * ============================================================
 * 服务：ToolService
 * 描述：工具管理核心服务 — 纯业务逻辑
 * 依赖：IConfigPort（配置读写）
 * 约束：仅通过 Port 接口与外部交互
 * ============================================================
 */

import type { IConfigPort } from '../ports';
import type { ToolInfo, ToolListResult, ToolCategory } from '../../shared/atoms';
import { BUILTIN_TOOLS, CATEGORY_ORDER } from '../../shared/atoms';

/** 工具服务构造参数 */
export interface ToolServiceOptions {
  configPort: IConfigPort;
}

/**
 * ToolService — 工具管理核心服务
 *
 * 原子不可变：BUILTIN_TOOLS 为不可变原子，仅通过本服务读取
 */
export class ToolService {
  private configPort: IConfigPort;

  constructor(options: ToolServiceOptions) {
    this.configPort = options.configPort;
  }

  /** 获取所有工具及状态 */
  async list(): Promise<ToolListResult> {
    const config = await this.configPort.read();

    // 全局工具开关（默认全部启用）
    const globalToolSettings = config.tools || {};

    // 主代理专属工具
    const primaryTools = config.experimental?.primary_tools || [];

    // 构建工具列表
    const tools: ToolInfo[] = BUILTIN_TOOLS.map(tool => ({
      ...tool,
      enabled: globalToolSettings[tool.id] !== false,
      agentOverrides: {},
    }));

    // 添加自定义工具
    const customTools = this.detectCustomTools(config as unknown as Record<string, unknown>);
    tools.push(...customTools.map(t => ({ ...t, enabled: true, agentOverrides: {} })));

    // 合并代理覆盖
    if (config.agent) {
      for (const [agentName, agentConfig] of Object.entries(config.agent)) {
        if (agentConfig.tools) {
          for (const tool of tools) {
            if (agentConfig.tools[tool.id] !== undefined) {
              tool.agentOverrides[agentName] = agentConfig.tools[tool.id];
            }
          }
        }
      }
    }

    // 按分类排序
    tools.sort((a, b) => {
      const aIdx = CATEGORY_ORDER.indexOf(a.category);
      const bIdx = CATEGORY_ORDER.indexOf(b.category);
      return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
    });

    return { tools, globalToolSettings, primaryTools };
  }

  /** 批量更新全局工具开关 */
  async updateGlobal(tools: Record<string, boolean>): Promise<Record<string, boolean>> {
    const config = await this.configPort.read();
    const currentTools = config.tools || {};
    const updated = { ...currentTools, ...tools };
    await this.configPort.write({ ...config, tools: updated });
    return updated;
  }

  /** 更新指定代理的工具覆盖 */
  async updateAgentOverrides(agentName: string, tools: Record<string, boolean>): Promise<Record<string, boolean>> {
    const config = await this.configPort.read();
    const agents = config.agent || {};

    if (!agents[agentName]) {
      throw new Error(`代理 "${agentName}" 不存在`);
    }

    const currentOverrides = agents[agentName].tools || {};
    const updated = { ...currentOverrides, ...tools };

    // 清理掉值为 null 的覆盖（恢复继承全局）
    for (const [key, val] of Object.entries(updated)) {
      if (val === null) {
        delete updated[key];
      }
    }

    agents[agentName].tools = updated;
    await this.configPort.write({ ...config, agent: agents });
    return updated;
  }

  /** 重置指定代理的工具覆盖 */
  async resetAgentOverrides(agentName: string): Promise<void> {
    const config = await this.configPort.read();
    const agents = config.agent || {};

    if (!agents[agentName]) {
      throw new Error(`代理 "${agentName}" 不存在`);
    }

    agents[agentName].tools = {};
    await this.configPort.write({ ...config, agent: agents });
  }

  /** 更新主代理专属工具列表 */
  async updatePrimaryTools(primaryTools: string[]): Promise<string[]> {
    const config = await this.configPort.read();
    const experimental = config.experimental || {};
    experimental.primary_tools = primaryTools;
    await this.configPort.write({ ...config, experimental });
    return primaryTools;
  }

  /** 检测自定义工具（从 provider 插件中检测） */
  private detectCustomTools(config: Record<string, unknown>): Array<Omit<ToolInfo, 'enabled' | 'agentOverrides'>> {
    const customTools: Array<Omit<ToolInfo, 'enabled' | 'agentOverrides'>> = [];
    const providers = (config as { provider?: Record<string, { npm?: string; api?: string }> }).provider;

    if (providers) {
      for (const [name, provider] of Object.entries(providers)) {
        if (provider.npm || provider.api) {
          customTools.push({
            id: `plugin-${name}`,
            name: `${name} 工具`,
            description: `由 ${name} 提供商提供的自定义工具`,
            category: '自定义' as ToolCategory,
            builtin: false,
            source: undefined,
          });
        }
      }
    }

    return customTools;
  }
}
