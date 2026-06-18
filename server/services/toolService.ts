/**
 * 工具管理服务
 * 管理内置工具和自定义工具的状态、代理覆盖和主代理专属工具
 */

import { configService } from './configService';
import type { ToolInfo, ToolCategory } from '../types';

/** 内置工具定义 */
const BUILTIN_TOOLS: Omit<ToolInfo, 'enabled' | 'agentOverrides'>[] = [
  // 文件操作
  { id: 'read', name: 'Read', description: '读取文件内容', category: '文件操作', builtin: true, source: null },
  { id: 'edit', name: 'Edit', description: '编辑文件内容', category: '文件操作', builtin: true, source: null },
  { id: 'write', name: 'Write', description: '写入文件', category: '文件操作', builtin: true, source: null },
  { id: 'glob', name: 'Glob', description: '文件模式匹配查找', category: '文件操作', builtin: true, source: null },
  { id: 'grep', name: 'Grep', description: '文件内容搜索', category: '文件操作', builtin: true, source: null },

  // 执行工具
  { id: 'bash', name: 'Bash', description: '执行 shell 命令', category: '执行工具', builtin: true, source: null },

  // 网络工具
  { id: 'webfetch', name: 'Web Fetch', description: '获取 URL 内容', category: '网络工具', builtin: true, source: null },
  { id: 'websearch', name: 'Web Search', description: '搜索网络信息', category: '网络工具', builtin: true, source: null },

  // 代理工具
  { id: 'task', name: 'Task', description: '启动子代理执行任务', category: '代理工具', builtin: true, source: null },

  // 工具链
  { id: 'todowrite', name: 'Todo Write', description: '创建和管理任务列表', category: '工具链', builtin: true, source: null },
  { id: 'skill', name: 'Skill', description: '加载技能文件', category: '工具链', builtin: true, source: null },

  // 其他
  { id: 'question', name: 'Question', description: '向用户提问', category: '工具链', builtin: true, source: null },
];

class ToolService {
  // ============================================================
  // 4.1.1 list() — 获取所有工具及状态
  // ============================================================
  async list(): Promise<{
    tools: ToolInfo[];
    globalToolSettings: Record<string, boolean>;
    primaryTools: string[];
  }> {
    const config = await configService.getConfig();

    // 全局工具开关（默认全部启用）
    const globalToolSettings = config.tools || {};

    // 主代理专属工具
    const primaryTools = config.experimental?.primary_tools || [];

    // 合并工具列表
    const tools: ToolInfo[] = BUILTIN_TOOLS.map(tool => ({
      ...tool,
      enabled: globalToolSettings[tool.id] !== false, // 默认启用
      agentOverrides: {},
    }));

    // 添加自定义工具（从 provider 插件中检测）
    const customTools = this.detectCustomTools(config);
    tools.push(...customTools);

    // 合并代理覆盖（从 agent 配置中读取工具覆盖）
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
    const categoryOrder: ToolCategory[] = ['文件操作', '执行工具', '网络工具', '代理工具', '工具链', '自定义'];
    tools.sort((a, b) => {
      const aIdx = categoryOrder.indexOf(a.category);
      const bIdx = categoryOrder.indexOf(b.category);
      return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
    });

    return { tools, globalToolSettings, primaryTools };
  }

  // ============================================================
  // 4.1.2 updateGlobal() — 批量更新全局工具开关
  // ============================================================
  async updateGlobal(tools: Record<string, boolean>): Promise<Record<string, boolean>> {
    const config = await configService.getConfig();
    const currentTools = config.tools || {};

    // 合并更新
    const updated = { ...currentTools, ...tools };
    await configService.updateConfig({ tools: updated });
    return updated;
  }

  // ============================================================
  // 4.1.3 updateAgentOverrides() — 更新指定代理的工具覆盖
  // ============================================================
  async updateAgentOverrides(
    agentName: string,
    tools: Record<string, boolean>,
  ): Promise<Record<string, boolean>> {
    const config = await configService.getConfig();
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
    await configService.updateConfig({ agent: agents });
    return updated;
  }

  // ============================================================
  // 4.1.4 resetAgentOverrides() — 重置指定代理的工具覆盖
  // ============================================================
  async resetAgentOverrides(agentName: string): Promise<void> {
    const config = await configService.getConfig();
    const agents = config.agent || {};

    if (!agents[agentName]) {
      throw new Error(`代理 "${agentName}" 不存在`);
    }

    agents[agentName].tools = {};
    await configService.updateConfig({ agent: agents });
  }

  // ============================================================
  // 4.1.5 updatePrimaryTools() — 更新主代理专属工具列表
  // ============================================================
  async updatePrimaryTools(primaryTools: string[]): Promise<string[]> {
    const config = await configService.getConfig();
    const experimental = config.experimental || {};
    experimental.primary_tools = primaryTools;
    await configService.updateConfig({ experimental });
    return primaryTools;
  }

  // ============================================================
  // 辅助方法：检测自定义工具
  // ============================================================
  private detectCustomTools(config: Record<string, unknown>): Omit<ToolInfo, 'enabled' | 'agentOverrides'>[] {
    const customTools: Omit<ToolInfo, 'enabled' | 'agentOverrides'>[] = [];

    // 从 provider 中检测插件提供的工具
    const providers = (config as { provider?: Record<string, { npm?: string; api?: string }> }).provider;
    if (providers) {
      for (const [name, provider] of Object.entries(providers)) {
        if (provider.npm || provider.api) {
          customTools.push({
            id: `plugin-${name}`,
            name: `${name} 工具`,
            description: `由 ${name} 提供商提供的自定义工具`,
            category: '自定义',
            builtin: false,
          });
        }
      }
    }

    return customTools;
  }
}

export const toolService = new ToolService();
