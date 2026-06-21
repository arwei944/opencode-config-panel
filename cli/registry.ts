/**
 * ============================================================
 * 命令注册中心
 * 约束：采用策略模式分发命令，集中注册
 * ============================================================
 */

import type { CommandDefinition, CommandHandler, CliContext } from './types';
import { helpHandler } from './commands/help';
import { statusHandler } from './commands/status';
import { doctorHandler } from './commands/doctor';
import {
  getHandler,
  setHandler,
  toggleHandler,
  validateHandler,
  formatHandler,
  exportHandler,
  importHandler,
  setModelHandler,
  setSmallModelHandler,
  setDefaultAgentHandler,
  disabledProvidersHandler,
  enabledProvidersHandler,
} from './commands/config';
import {
  listHandler,
  addHandler,
  removeHandler,
  providerUpdateHandler,
  providerListModelsHandler,
  providerTestHandler,
  providerEstimateHandler,
  providerDoctorHandler,
} from './commands/providers';
import {
  agentCreateHandler,
  agentDeleteHandler,
  agentUpdateHandler,
  agentSetPermissionHandler,
  agentDoctorHandler,
} from './commands/agents';
import { backupHandler, rollbackHandler, diffHandler } from './commands/backups';
import { keyHandler } from './commands/keys';
import { templateHandler, profileHandler } from './commands/template';
import {
  logHandler,
  jsonHandler,
  skillsHandler,
  mcpHandler,
  toolHandler,
  serverHandler,
  pluginHandler,
  referenceHandler,
  commandCustomHandler,
  compactionHandler,
  toolOutputHandler,
  experimentalHandler,
  attachmentHandler,
  uiHandler,
  selfUpdateHandler,
} from './commands/remaining';

/** 命令注册表 */
const commandRegistry: Record<string, CommandDefinition> = {};

/** 递归注册命令 */
function register(cmd: CommandDefinition): void {
  commandRegistry[cmd.name] = cmd;
  for (const alias of cmd.aliases) {
    commandRegistry[alias] = cmd;
  }
}

// ============================================================
// 注册所有命令
// ============================================================

// 基础
register({ name: 'help', aliases: ['-h', '--help'], description: '显示帮助', handler: helpHandler });
register({ name: 'status', aliases: [], description: '显示配置概览', handler: statusHandler });
register({ name: 'doctor', aliases: [], description: '健康检查', handler: doctorHandler });

// 配置
register({ name: 'get', aliases: [], description: '获取配置值', handler: getHandler });
register({ name: 'set', aliases: [], description: '设置配置值', handler: setHandler });
register({ name: 'toggle', aliases: [], description: '切换布尔值', handler: toggleHandler });
register({ name: 'validate', aliases: [], description: '验证配置', handler: validateHandler });
register({ name: 'format', aliases: [], description: '格式化配置', handler: formatHandler });
register({ name: 'export', aliases: [], description: '导出配置', handler: exportHandler });
register({ name: 'import', aliases: [], description: '导入配置', handler: importHandler });
register({ name: 'set-model', aliases: [], description: '设置主模型', handler: setModelHandler });
register({ name: 'set-small-model', aliases: ['set_small_model'], description: '设置轻量模型', handler: setSmallModelHandler });
register({ name: 'set-default-agent', aliases: ['set_default_agent'], description: '设置默认代理', handler: setDefaultAgentHandler });
register({ name: 'disabled-providers', aliases: ['disabled_providers'], description: '管理禁用提供商', handler: disabledProvidersHandler });
register({ name: 'enabled-providers', aliases: ['enabled_providers'], description: '管理仅限提供商', handler: enabledProvidersHandler });

// 提供商
register({ name: 'list', aliases: [], description: '列出资源', handler: listHandler });
register({ name: 'add', aliases: [], description: '添加提供商', handler: addHandler });
register({ name: 'remove', aliases: [], description: '删除提供商', handler: removeHandler });
register({ name: 'provider', aliases: ['providers'], description: '提供商管理', handler: providerCommandDispatcher });
register({ name: 'providers', aliases: [], description: '提供商管理', handler: providerCommandDispatcher });

// 代理
register({ name: 'agent', aliases: [], description: '智能体管理', handler: agentCommandDispatcher });

// 备份 / 回滚 / 差异
register({ name: 'backup', aliases: [], description: '备份管理', handler: backupHandler });
register({ name: 'rollback', aliases: [], description: '一键回滚', handler: rollbackHandler });
register({ name: 'diff', aliases: [], description: '差异对比', handler: diffHandler });

// 密钥
register({ name: 'key', aliases: [], description: '密钥管理', handler: keyHandler });

// 模板 / Profile
register({ name: 'template', aliases: ['templates'], description: '模板管理', handler: templateHandler });
register({ name: 'profile', aliases: ['profiles'], description: 'Profile 管理', handler: profileHandler });

// 日志
register({ name: 'log', aliases: [], description: '审计日志', handler: logHandler });

// JSON
register({ name: 'json', aliases: [], description: 'JSON 直接操作', handler: jsonHandler });

// 技能 / MCP / 工具
register({ name: 'skills', aliases: ['skill'], description: '技能管理', handler: skillsHandler });
register({ name: 'mcp', aliases: [], description: 'MCP 服务器管理', handler: mcpHandler });
register({ name: 'tool', aliases: ['tools'], description: '工具管理', handler: toolHandler });
register({ name: 'tools', aliases: [], description: '工具管理', handler: toolHandler });

// 服务器 / 插件
register({ name: 'server', aliases: [], description: '服务器配置', handler: serverHandler });
register({ name: 'plugin', aliases: ['plugins'], description: '插件管理', handler: pluginHandler });

// 引用
register({ name: 'reference', aliases: ['references', 'ref'], description: '引用管理', handler: referenceHandler });

// 自定义命令
register({ name: 'command', aliases: ['commands'], description: '自定义命令', handler: commandCustomHandler });

// 高级设置
register({ name: 'compaction', aliases: [], description: '上下文压缩配置', handler: compactionHandler });
register({ name: 'tool-output', aliases: ['tool_output'], description: '工具输出阈值', handler: toolOutputHandler });
register({ name: 'experimental', aliases: [], description: '实验性功能开关', handler: experimentalHandler });
register({ name: 'attachment', aliases: [], description: '图片附件限制', handler: attachmentHandler });

// 其他
register({ name: 'ui', aliases: [], description: '启动 Web 控制台', handler: uiHandler });
register({ name: 'self', aliases: [], description: '自更新', handler: selfCommandDispatcher });

// ============================================================
// 子命令派发器
// ============================================================

async function providerCommandDispatcher(args: string[], ctx: CliContext): Promise<void> {
  const sub = args[0];
  if (!sub) { ctx.term.err('用法: provider <update|list-models|test|estimate|doctor> ...'); return; }
  switch (sub) {
    case 'update': await providerUpdateHandler(args.slice(1), ctx); break;
    case 'list-models':
    case 'list-m': await providerListModelsHandler(args.slice(1), ctx); break;
    case 'test': await providerTestHandler(args.slice(1), ctx); break;
    case 'estimate': await providerEstimateHandler(args.slice(1), ctx); break;
    case 'doctor': await providerDoctorHandler(args.slice(1), ctx); break;
    default: ctx.term.err(`未知 provider 子命令: ${sub}`);
  }
}

async function agentCommandDispatcher(args: string[], ctx: CliContext): Promise<void> {
  const sub = args[0];
  if (!sub) { ctx.term.err('用法: agent <create|delete|update|set-permission|doctor> ...'); return; }
  switch (sub) {
    case 'create': await agentCreateHandler(args.slice(1), ctx); break;
    case 'delete':
    case 'rm': await agentDeleteHandler(args.slice(1), ctx); break;
    case 'update': await agentUpdateHandler(args.slice(1), ctx); break;
    case 'set-permission':
    case 'set-perm': await agentSetPermissionHandler(args.slice(1), ctx); break;
    case 'doctor': await agentDoctorHandler(args.slice(1), ctx); break;
    default: ctx.term.err(`未知 agent 子命令: ${sub}`);
  }
}

async function selfCommandDispatcher(args: string[], ctx: CliContext): Promise<void> {
  const sub = args[0];
  if (sub === 'update') { await selfUpdateHandler(args.slice(1), ctx); return; }
  ctx.term.err('用法: self update');
}

// ============================================================
// 命令分发
// ============================================================

/** 根据命令名查找并执行 */
export async function dispatch(cmdName: string, args: string[], ctx: CliContext): Promise<boolean> {
  const def = commandRegistry[cmdName];
  if (!def) return false;
  await def.handler(args, ctx);
  return true;
}

/** 获取所有命令名（用于帮助） */
export function getCommandNames(): string[] {
  const names = new Set<string>();
  for (const [key, def] of Object.entries(commandRegistry)) {
    if (key === def.name || def.aliases.includes(key)) continue;
    names.add(def.name);
  }
  return [...names].sort();
}
