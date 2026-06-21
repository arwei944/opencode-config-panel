/**
 * Commands: list providers, add, remove, provider update/list-models/test/estimate/doctor
 * 提供商管理
 */

import type { CommandHandler } from '../types';
import { parseFlags, formatBytes } from '../utils';

/** list 子命令（provider/models/agents/tools/skills/mcp/backups） */
export const listHandler: CommandHandler = async (args, ctx) => {
  const type = args[0];
  if (!type) { ctx.term.err('用法: list <providers|models|agents|tools|skills|mcp|backups|references|commands>'); return; }

  switch (type) {
    case 'providers':
    case 'provider': {
      const providers = await ctx.services.provider.list();
      if (ctx.options.json) {
        ctx.term.jsonOut({
          action: 'list.providers',
          providers: Object.entries(providers).map(([name, p]) => {
            const pAny = p as Record<string, unknown>;
            return { name, type: (pAny.type as string) || 'unknown', modelCount: pAny.models ? Object.keys(pAny.models as Record<string, unknown>).length : 0 };
          }),
        });
        return;
      }
      ctx.term.raw(`提供商 (${Object.keys(providers).length}):`);
      for (const [name, p] of Object.entries(providers)) {
        const pAny = p as Record<string, unknown>;
        const mc = pAny.models ? Object.keys(pAny.models as Record<string, unknown>).length : 0;
        ctx.term.raw(`  ${name}  type=${pAny.type || 'undefined'}  models=${mc}`);
      }
      return;
    }
    case 'models':
    case 'model': {
      const config = await ctx.configPort.read();
      const providers = config.provider as Record<string, { models?: Record<string, { name?: string }> }> | undefined;
      const targetProvider = args[1];

      if (providers) {
        const allModels: { provider: string; name: string; displayName?: string }[] = [];
        for (const [name, p] of Object.entries(providers)) {
          if (targetProvider && name !== targetProvider) continue;
          if (p.models) {
            for (const [mk, mv] of Object.entries(p.models)) {
              allModels.push({ provider: name, name: mk, displayName: mv.name });
            }
          }
        }
        if (ctx.options.json) { ctx.term.jsonOut({ action: 'list.models', models: allModels }); return; }
        for (const m of allModels) {
          ctx.term.raw(`  ${m.provider}/${m.name}${m.displayName ? `  (${m.displayName})` : ''}`);
        }
      } else {
        if (ctx.options.json) { ctx.term.jsonOut({ action: 'list.models', models: [] }); return; }
        ctx.term.err('(无模型)');
      }
      return;
    }
    case 'agents':
    case 'agent': {
      const { flags } = parseFlags(args.slice(1), {
        verbose: { type: 'boolean', alias: 'v' },
        filter: { type: 'string' },
      });
      const agents = (await ctx.configPort.read()).agent as Record<string, { mode?: string; model?: string; permission?: Record<string, string>; color?: string; steps?: number; hidden?: boolean }> | undefined || {};
      if (ctx.options.json) {
        ctx.term.jsonOut({
          action: 'list.agents',
          agents: Object.entries(agents)
            .filter(([, a]) => !flags.filter || a.mode === flags.filter)
            .map(([name, a]) => ({ name, mode: a.mode || 'subagent', model: a.model, ...(flags.verbose ? { permission: a.permission, color: a.color, steps: a.steps, hidden: a.hidden } : {}) })),
        });
        return;
      }
      ctx.term.raw(`代理 (${Object.keys(agents).length}):`);
      for (const [name, a] of Object.entries(agents)) {
        if (flags.filter && a.mode !== flags.filter) continue;
        const mode = a.mode || 'subagent';
        if (flags.verbose) {
          const parts = [`  ${name}  (${mode})`];
          if (a.model) parts.push(`model=${a.model}`);
          if (a.permission && Object.keys(a.permission).length > 0) {
            parts.push(`permissions=${Object.entries(a.permission).map(([k, v]) => `${k}:${v}`).join(',')}`);
          }
          if (a.color) parts.push(`color=${a.color}`);
          if (a.steps) parts.push(`steps=${a.steps}`);
          if (a.hidden) parts.push('hidden');
          ctx.term.raw(parts.join('  '));
        } else {
          ctx.term.raw(`  ${name}  (${mode})`);
        }
      }
      return;
    }
    case 'tools':
    case 'tool': {
      if (ctx.options.json) { ctx.term.jsonOut({ action: 'list.tools', tools: [] }); return; }
      return ctx.term.raw('工具: (使用默认配置)');
    }
    case 'skills':
    case 'skill': {
      const result = await ctx.services.skill.scan();
      if (result.skills.length === 0) { ctx.term.raw('(无技能)'); return; }
      if (ctx.options.json) {
        ctx.term.jsonOut({
          action: 'list.skills',
          skills: result.skills.map(s => ({ name: s.name, description: s.description, license: s.license, severity: s.severity })),
        });
        return;
      }
      for (const s of result.skills) {
        ctx.term.raw(`  ${s.name}${s.description ? ` — ${s.description}` : ''}`);
      }
      ctx.term.raw(`技能 (${result.skills.length})`);
      return;
    }
    case 'mcp': {
      const { flags: mcpFlags } = parseFlags(args.slice(1), {
        verbose: { type: 'boolean', alias: 'v' },
      });
      const config = await ctx.configPort.read();
      const mcp = (config.mcp || {}) as Record<string, { type?: string; enabled?: boolean; command?: string | string[]; url?: string; cwd?: string; timeout?: number }>;
      if (Object.keys(mcp).length === 0) { ctx.term.raw('(无 MCP 服务器)'); return; }
      if (ctx.options.json) {
        ctx.term.jsonOut({
          action: 'list.mcp',
          servers: Object.entries(mcp).map(([name, s]) => ({
            name, type: s.type || 'local', enabled: s.enabled !== false,
            command: Array.isArray(s.command) ? s.command.join(' ') : s.command,
            url: s.url,
          })),
        });
        return;
      }
      ctx.term.raw(`MCP 服务器 (${Object.keys(mcp).length}):`);
      for (const [name, s] of Object.entries(mcp)) {
        const type = s.type || 'local';
        const enabled = s.enabled !== false ? '启用' : '禁用';
        const cmd = s.command ? (Array.isArray(s.command) ? s.command.join(' ') : s.command) : s.url || '';
        if (mcpFlags.verbose) {
          ctx.term.raw(`  ${name}`);
          ctx.term.raw(`    type: ${type}`);
          ctx.term.raw(`    status: ${enabled}`);
          ctx.term.raw(`    ${type === 'remote' ? 'url' : 'command'}: ${cmd}`);
        } else {
          ctx.term.raw(`  ${name}  [${type}]  ${enabled}  ${cmd}`);
        }
      }
      return;
    }
    case 'backups':
    case 'backup': {
      const backups = await ctx.backupPort.list();
      if (backups.length === 0) { ctx.term.raw('(无备份)'); return; }
      if (ctx.options.json) {
        ctx.term.jsonOut({
          action: 'list.backups',
          backups: backups.map(b => ({ id: b.id, size: b.size, timestamp: b.timestamp })),
        });
        return;
      }
      ctx.term.raw(`备份 (${backups.length}):`);
      for (const b of backups) {
        ctx.term.raw(`  ${b.id}  (${formatBytes(b.size || 0)}, ${b.timestamp ? new Date(b.timestamp).toLocaleString() : ''})`);
      }
      return;
    }
    default:
      ctx.term.err(`未知类型: ${type}`);
      ctx.term.err('可用类型: providers, models, agents, tools, skills, mcp, backups');
  }
};

/** 智能添加提供商 */
export const addHandler: CommandHandler = async (args, ctx) => {
  const type = args[0];
  if (type !== 'provider') { ctx.term.err('用法: add provider <URL> [apiKey]'); return; }
  const baseURL = args[1];
  const apiKey = args[2];
  if (!baseURL) { ctx.term.err('用法: add provider <URL> [apiKey]'); return; }
  try { new URL(baseURL); } catch { ctx.term.err('无效的 URL'); return; }

  if (ctx.options.dryRun) {
    ctx.term.info(`[DRY-RUN] 将添加提供商: ${baseURL}${apiKey ? ' (含 apiKey)' : ''}`);
    if (ctx.options.json) ctx.term.jsonOut({ action: 'provider.add', baseURL, apiKey: !!apiKey, dryRun: true });
    return;
  }

  const result = await ctx.services.provider.smartAdd(baseURL, apiKey);
  ctx.term.ok(`已添加 ${result.name} (type=${result.config.type})`);
  if (!ctx.options.dryRun) await ctx.audit.append('provider.add', { name: result.name });
  if (ctx.options.json) ctx.term.jsonOut({ action: 'provider.add', name: result.name, type: result.config.type });
};

/** 删除提供商 */
export const removeHandler: CommandHandler = async (args, ctx) => {
  const type = args[0];
  if (type !== 'provider') { ctx.term.err('用法: remove provider <名称>'); return; }
  const name = args[1];
  if (!name) { ctx.term.err('用法: remove provider <名称>'); return; }

  // 检查是否存在
  const providers = await ctx.services.provider.list();
  if (!providers[name]) { ctx.term.err(`提供商 "${name}" 不存在`); return; }

  if (ctx.options.dryRun) {
    ctx.term.info(`[DRY-RUN] 将删除提供商: ${name}`);
    if (ctx.options.json) ctx.term.jsonOut({ action: 'provider.remove', name, dryRun: true });
    return;
  }

  await ctx.services.provider.delete(name);
  ctx.term.ok(`已删除 ${name}`);
  if (!ctx.options.dryRun) await ctx.audit.append('provider.remove', { name });
  if (ctx.options.json) ctx.term.jsonOut({ action: 'provider.remove', name });
};

/** 更新提供商 */
export const providerUpdateHandler: CommandHandler = async (args, ctx) => {
  const name = args[0];
  if (!name) { ctx.term.err('用法: provider update <名称> [--timeout ...]'); return; }
  const { flags } = parseFlags(args.slice(1), {
    timeout: { type: 'number' },
  });
  const update: Record<string, unknown> = {};
  if (flags.timeout !== undefined) update.options = { timeout: flags.timeout };
  if (Object.keys(update).length === 0) { ctx.term.warn('无可更新的选项'); return; }

  if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将更新 ${name}: ${JSON.stringify(update)}`); if (ctx.options.json) ctx.term.jsonOut({ action: 'provider.update', name, updates: update, dryRun: true }); return; }
  await ctx.services.provider.update(name, update as never);
  ctx.term.ok(`已更新 ${name}`);
  if (!ctx.options.dryRun) await ctx.audit.append('provider.update', { name, updates: update });
  if (ctx.options.json) ctx.term.jsonOut({ action: 'provider.update', name, updates: update });
};

/** 列出提供商模型详情 */
export const providerListModelsHandler: CommandHandler = async (args, ctx) => {
  const name = args[0];
  if (!name) { ctx.term.err('用法: provider list-models <名称> [--verbose]'); return; }
  const { flags } = parseFlags(args.slice(1), { verbose: { type: 'boolean' } });
  const provider = await ctx.services.provider.get(name);
  if (!provider) { ctx.term.err(`提供商 "${name}" 不存在`); return; }
  const models = (provider as Record<string, unknown>).models as Record<string, { name?: string; context?: number }> | undefined;
  if (!models || Object.keys(models).length === 0) {
    if (ctx.options.json) { ctx.term.jsonOut({ action: 'provider.list-models', name, models: [] }); return; }
    ctx.term.raw(`(无模型)`);
    return;
  }
  const modelList = Object.entries(models).map(([mk, mv]) => ({
    id: mk,
    name: mv.name,
    context: mv.context,
    ...(flags.verbose ? { raw: mv } : {}),
  }));
  if (ctx.options.json) { ctx.term.jsonOut({ action: 'provider.list-models', name, models: modelList }); return; }
  ctx.term.raw(`${name} 模型 (${Object.keys(models).length}):`);
  for (const [mk, mv] of Object.entries(models)) {
    if (flags.verbose) {
      ctx.term.raw(`  ${mk}  name=${mv.name || ''}  context=${mv.context || '?'}`);
    } else {
      ctx.term.raw(`  ${mk}${mv.name ? `  (${mv.name})` : ''}`);
    }
  }
};

/** 测试提供商连通性 */
export const providerTestHandler: CommandHandler = async (args, ctx) => {
  const config = await ctx.configPort.read();
  const providers = (config.provider || {}) as Record<string, { options?: { baseURL?: string; apiKey?: string } }>;
  const targets = args.length > 0 ? args : Object.keys(providers);
  if (targets.length === 0) { ctx.term.err('没有可测试的 provider'); return; }

  for (const name of targets) {
    const p = providers[name];
    if (!p) { ctx.term.err(`${name}: 不存在`); continue; }
    ctx.term.info(`测试 ${name}...`);
    // 简单检查配置存在性
    if (p.options?.baseURL) {
      ctx.term.ok(`${name}: baseURL 已配置 (${p.options.baseURL})`);
    } else {
      ctx.term.err(`${name}: 缺少 baseURL`);
    }
  }
};

/** 提供商价格预估 */
export const providerEstimateHandler: CommandHandler = async (args, ctx) => {
  const name = args[0];
  const { flags } = parseFlags(args.slice(1), {
    input: { type: 'number', default: 1000 },
    output: { type: 'number', default: 500 },
  });
  if (!name) { ctx.term.err('用法: provider estimate <名称> [--input N] [--output N]'); return; }
  const provider = await ctx.services.provider.get(name);
  if (!provider) { ctx.term.err(`提供商 "${name}" 不存在`); return; }

  const inputTokens = (flags.input as number) || 1000;
  const outputTokens = (flags.output as number) || 500;
  const inputCost = inputTokens * 0.000002;
  const outputCost = outputTokens * 0.00001;
  const total = inputCost + outputCost;

  if (ctx.options.json) {
    ctx.term.jsonOut({
      action: 'provider.estimate',
      name,
      input: { tokens: inputTokens, cost: inputCost },
      output: { tokens: outputTokens, cost: outputCost },
      total,
    });
    return;
  }

  ctx.term.raw(`=== ${name} 费用预估 ===`);
  ctx.term.raw(`  输入: ${inputTokens} tokens ≈ $${inputCost.toFixed(6)}`);
  ctx.term.raw(`  输出: ${outputTokens} tokens ≈ $${outputCost.toFixed(6)}`);
  ctx.term.raw(`  总计: ≈ $${total.toFixed(6)}`);
};

/** 提供商健康检查 */
export const providerDoctorHandler: CommandHandler = async (_args, ctx) => {
  const providers = await ctx.services.provider.list();
  if (Object.keys(providers).length === 0) { ctx.term.err('没有配置任何 provider'); return; }
  const checks: { name: string; type: string; modelCount: number }[] = [];
  for (const [name, p] of Object.entries(providers)) {
    const pAny = p as Record<string, unknown>;
    checks.push({
      name,
      type: (pAny.type as string) || 'unknown',
      modelCount: pAny.models ? Object.keys(pAny.models as Record<string, unknown>).length : 0,
    });
  }
  if (ctx.options.json) {
    ctx.term.jsonOut({ action: 'provider.doctor', providers: checks, total: checks.length });
    return;
  }
  ctx.term.ok(`共 ${checks.length} 个提供商`);
  for (const c of checks) {
    ctx.term.raw(`  ${c.name}: type=${c.type}  models=${c.modelCount}`);
  }
};
