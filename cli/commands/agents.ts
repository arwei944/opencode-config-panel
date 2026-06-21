/**
 * Commands: agent create/delete/update/set-permission/doctor
 * 智能体管理
 */

import path from 'node:path';
import os from 'node:os';
import type { CommandHandler } from '../types';
import { parseFlags } from '../utils';

const AGENTS_DIR = path.join(os.homedir(), '.config', 'opencode', 'agents');

/** 创建代理 */
export const agentCreateHandler: CommandHandler = async (args, ctx) => {
  const name = args[0];
  if (!name) { ctx.term.err('用法: agent create <名称> [模式] <描述> [model]'); return; }

  // 解析参数
  let mode = 'primary';
  let description = '';
  let model = '';
  const rest = args.slice(1);

  if (rest.length >= 1 && ['primary', 'subagent', 'explore', 'general'].includes(rest[0])) {
    mode = rest[0];
    description = rest[1] || '';
    model = rest[2] || '';
  } else if (rest.length >= 1) {
    description = rest[0];
    model = rest[1] || '';
  }

  if (!/^[a-z0-9-]{2,32}$/.test(name)) {
    ctx.term.err('代理名称必须为小写字母、数字、连字符，2-32 字符');
    return;
  }

  const config = await ctx.configPort.read();
  const agents = (config.agent || {}) as Record<string, unknown>;
  if (agents[name]) {
    ctx.term.err(`代理 "${name}" 已存在`);
    return;
  }

  if (ctx.options.dryRun) {
    ctx.term.info(`[DRY-RUN] 将创建代理: ${name} (${mode})`);
    if (ctx.options.json) ctx.term.jsonOut({ action: 'agent.create', name, mode, description, model, dryRun: true });
    return;
  }

  // 写入 config
  const newAgent: Record<string, unknown> = { mode };
  if (description) newAgent.description = description;
  if (model) newAgent.model = model;
  agents[name] = newAgent;
  await ctx.configPort.write({ ...config, agent: agents } as never);

  // 写入 .md 文件
  await ctx.fs.ensureDir(AGENTS_DIR);
  const mdContent = `---\nname: ${name}\nmode: ${mode}\ndescription: "${description}"\n---\n\n# ${name}\n\n${description}\n`;
  await ctx.fs.writeFile(path.join(AGENTS_DIR, `${name}.md`), mdContent);

  ctx.term.ok(`已创建代理: ${name} (${mode})`);
  if (!ctx.options.dryRun) await ctx.audit.append('agent.create', { name, mode, description });
  if (ctx.options.json) ctx.term.jsonOut({ action: 'agent.create', name, mode, description, model });
};

/** 删除代理 */
export const agentDeleteHandler: CommandHandler = async (args, ctx) => {
  const name = args[0];
  if (!name) { ctx.term.err('用法: agent delete <名称>'); return; }

  const config = await ctx.configPort.read();
  const agents = (config.agent || {}) as Record<string, unknown>;
  if (!agents[name]) { ctx.term.err(`代理 "${name}" 不存在`); return; }

  if (ctx.options.dryRun) {
    ctx.term.info(`[DRY-RUN] 将删除代理: ${name}`);
    if (ctx.options.json) ctx.term.jsonOut({ action: 'agent.delete', name, dryRun: true });
    return;
  }

  delete agents[name];
  await ctx.configPort.write({ ...config, agent: agents } as never);

  // 删除 .md 文件
  try { await ctx.fs.deleteFile(path.join(AGENTS_DIR, `${name}.md`)); } catch { /* ignore */ }

  ctx.term.ok(`已删除代理: ${name}`);
  if (!ctx.options.dryRun) await ctx.audit.append('agent.delete', { name });
  if (ctx.options.json) ctx.term.jsonOut({ action: 'agent.delete', name });
};

/** 更新代理 */
export const agentUpdateHandler: CommandHandler = async (args, ctx) => {
  const name = args[0];
  if (!name) { ctx.term.err('用法: agent update <名称> [--desc] [--model] [--mode] ...'); return; }
  const { flags } = parseFlags(args.slice(1), {
    desc: { type: 'string' },
    model: { type: 'string' },
    mode: { type: 'string' },
    steps: { type: 'number' },
    'set-permission': { type: 'string' },
  });

  const config = await ctx.configPort.read();
  const agents = (config.agent || {}) as Record<string, Record<string, unknown>>;
  if (!agents[name]) { ctx.term.err(`代理 "${name}" 不存在`); return; }

  const update: Record<string, unknown> = {};
  if (flags.desc !== undefined) update.description = flags.desc;
  if (flags.model !== undefined) update.model = flags.model;
  if (flags.mode !== undefined) update.mode = flags.mode;
  if (flags.steps !== undefined) update.steps = flags.steps;

  if (Object.keys(update).length === 0) { ctx.term.warn('无可更新的属性'); return; }

  if (ctx.options.dryRun) {
    ctx.term.info(`[DRY-RUN] 将更新 ${name}: ${JSON.stringify(update)}`);
    if (ctx.options.json) ctx.term.jsonOut({ action: 'agent.update', name, updates: update, dryRun: true });
    return;
  }

  agents[name] = { ...agents[name], ...update };
  await ctx.configPort.write({ ...config, agent: agents } as never);
  ctx.term.ok(`已更新代理: ${name}`);
  if (!ctx.options.dryRun) await ctx.audit.append('agent.update', { name, updates: update });
  if (ctx.options.json) ctx.term.jsonOut({ action: 'agent.update', name, updates: update });
};

/** 设置代理权限 */
export const agentSetPermissionHandler: CommandHandler = async (args, ctx) => {
  const name = args[0];
  if (!name) { ctx.term.err('用法: agent set-permission <名称> <工具>=<动作> [...]'); return; }
  const permissions = args.slice(1);
  if (permissions.length === 0) { ctx.term.err('用法: agent set-permission <名称> <工具>=<动作> [...]'); return; }

  const permMap: Record<string, string> = {};
  for (const p of permissions) {
    const parts = p.split('=');
    if (parts.length !== 2) { ctx.term.warn(`忽略无效格式: ${p}`); continue; }
    permMap[parts[0]] = parts[1];
  }

  if (Object.keys(permMap).length === 0) { ctx.term.err('无有效权限'); return; }

  const config = await ctx.configPort.read();
  const agents = (config.agent || {}) as Record<string, Record<string, unknown>>;
  if (!agents[name]) { ctx.term.err(`代理 "${name}" 不存在`); return; }

  if (ctx.options.dryRun) {
    ctx.term.info(`[DRY-RUN] 将设置 ${name} 权限: ${JSON.stringify(permMap)}`);
    if (ctx.options.json) ctx.term.jsonOut({ action: 'agent.set-permission', name, permissions: permMap, dryRun: true });
    return;
  }

  agents[name].permission = { ...(agents[name].permission as Record<string, string> || {}), ...permMap };
  await ctx.configPort.write({ ...config, agent: agents } as never);
  ctx.term.ok(`已设置 ${name} 权限: ${Object.keys(permMap).length} 条`);
  if (!ctx.options.dryRun) await ctx.audit.append('agent.set-permission', { name, permissions: permMap });
  if (ctx.options.json) ctx.term.jsonOut({ action: 'agent.set-permission', name, permissions: permMap });
};

/** 代理健康检查 */
export const agentDoctorHandler: CommandHandler = async (_args, ctx) => {
  const config = await ctx.configPort.read();
  const agents = config.agent as Record<string, { mode?: string; model?: string }>;

  if (Object.keys(agents).length === 0) { ctx.term.warn('没有配置任何代理'); return; }

  let issues = 0;
  const agentChecks: { name: string; hasMode: boolean }[] = [];
  for (const [name, a] of Object.entries(agents)) {
    const hasMode = !!a.mode;
    agentChecks.push({ name, hasMode });
    if (!a.mode) { ctx.term.warn(`${name}: 缺少 mode`); issues++; }
  }
  if (issues === 0) ctx.term.ok(`所有 ${Object.keys(agents).length} 个代理正常`);

  if (ctx.options.json) ctx.term.jsonOut({ action: 'agent.doctor', total: Object.keys(agents).length, issues, agents: agentChecks });
};
