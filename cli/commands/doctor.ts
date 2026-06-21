/**
 * Command: doctor
 * 健康检查
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { CommandHandler } from '../types';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'opencode');
const CONFIG_PATH = path.join(CONFIG_DIR, 'opencode.json');
const BACKUPS_DIR = path.join(CONFIG_DIR, 'backups');

export const doctorHandler: CommandHandler = async (args, ctx) => {
  const config = await ctx.configPort.read();
  const issues: string[] = [];
  const warnings: string[] = [];
  const passed: string[] = [];
  const fix = args.includes('--fix') || args.includes('-f');

  // 1. JSON 语法
  try {
    const raw = await ctx.fs.readFile(CONFIG_PATH);
    JSON.parse(raw);
    passed.push('配置 JSON 语法正确');
  } catch (e) {
    issues.push(`配置 JSON 无效: ${(e as Error).message}`);
  }

  // 2. provider
  const providers = (config.provider || {}) as Record<string, { options?: { baseURL?: string; apiKey?: string }; models?: Record<string, unknown> }>;
  if (Object.keys(providers).length === 0) {
    warnings.push('没有配置任何 provider');
  }
  for (const [name, p] of Object.entries(providers)) {
    if (!p.options) { issues.push(`provider ${name}: 缺少 options`); continue; }
    if (!p.options.baseURL) issues.push(`provider ${name}: 缺少 baseURL`);
    if (!p.options.apiKey) warnings.push(`provider ${name}: 未设置 apiKey`);
    if (!p.models || Object.keys(p.models).length === 0) {
      warnings.push(`provider ${name}: 未配置任何模型`);
    }
  }

  // 3. model 引用
  if (config.model) {
    const [pname, mid] = (config.model as string).split('/');
    if (!providers[pname]) {
      issues.push(`默认 model ${config.model}: provider "${pname}" 不存在`);
    } else if (mid && (!providers[pname].models || !providers[pname].models![mid])) {
      issues.push(`默认 model ${config.model}: 模型 "${mid}" 在 ${pname} 中未定义`);
    }
  }
  if (config.small_model) {
    const [pname, mid] = (config.small_model as string).split('/');
    if (!providers[pname]) {
      issues.push(`small_model ${config.small_model}: provider "${pname}" 不存在`);
    } else if (mid && (!providers[pname].models || !providers[pname].models![mid])) {
      issues.push(`small_model ${config.small_model}: 模型 "${mid}" 在 ${pname} 中未定义`);
    }
  }

  // 4. agent 引用
  const agents = (config.agent || {}) as Record<string, { model?: string }>;
  for (const [name, a] of Object.entries(agents)) {
    if (a.model) {
      const [pname, mid] = a.model.split('/');
      if (!providers[pname]) {
        issues.push(`agent ${name}: 引用了不存在的 provider ${pname}`);
      } else if (mid && (!providers[pname].models || !providers[pname].models![mid])) {
        issues.push(`agent ${name}: 引用了不存在的模型 ${a.model}`);
      }
    }
  }

  // 5. default_agent
  if (config.default_agent) {
    if (!agents[config.default_agent as string]) {
      warnings.push(`default_agent ${config.default_agent} 在 config.agent 中未定义`);
    }
  }

  // 6. skill 路径
  const skills = (config.skills || {}) as { paths?: string[] };
  for (const p of (skills.paths || [])) {
    try { await ctx.fs.stat(p); } catch { warnings.push(`技能路径不存在: ${p}`); }
  }

  // 7. 备份目录
  let backupCount = 0;
  let backupSize = 0;
  try {
    const files = await fs.readdir(BACKUPS_DIR);
    for (const f of files) {
      try {
        const stat = await fs.stat(path.join(BACKUPS_DIR, f));
        backupCount++;
        backupSize += stat.size;
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  if (backupCount > 50) {
    warnings.push(`备份数量过多: ${backupCount} 个，建议清理 (backup cleanup)`);
  }

  if (fix) {
    const fixed: string[] = [];
    if (!config.provider) { (config as Record<string, unknown>).provider = {}; fixed.push('创建 provider 对象'); }
    if (!config.skills) { (config as Record<string, unknown>).skills = {}; fixed.push('创建 skills 对象'); }
    if (!config.tools) { (config as Record<string, unknown>).tools = {}; fixed.push('创建 tools 对象'); }
    if (Object.keys(providers).length === 0) fixed.push('provider 为空，未修改');
    if (Object.keys(config.skills as Record<string, unknown> || {}).length === 0) fixed.push('skills 为空，未修改');
    if (Object.keys(config.tools as Record<string, unknown> || {}).length === 0) fixed.push('tools 为空，未修改');

    if (!ctx.options.dryRun && fixed.length > 0) {
      await ctx.configPort.write(config);
    }

    if (ctx.options.json) {
      ctx.term.jsonOut({ fix, fixed, issues, warnings, passed });
      return;
    }
    for (const line of fixed) ctx.term.info(`[FIX] ${line}`);
  }

  if (ctx.options.json) {
    ctx.term.jsonOut({ issues, warnings, passed, summary: { providers: Object.keys(providers).length, agents: Object.keys(agents).length, backups: backupCount, backupSize } });
    return;
  }

  ctx.term.raw('========================================');
  ctx.term.raw('  Opencode 配置健康检查');
  ctx.term.raw('========================================');
  for (const p of passed) ctx.term.ok(p);
  for (const w of warnings) ctx.term.warn(w);
  for (const i of issues) ctx.term.err(i);

  ctx.term.raw('----------------------------------------');
  ctx.term.raw(`  providers: ${Object.keys(providers).length}`);
  ctx.term.raw(`  agents:    ${Object.keys(agents).length}`);
  ctx.term.raw(`  backups:   ${backupCount} ${backupSize > 0 ? `(${(backupSize / 1024).toFixed(1)} KB)` : ''}`);
  ctx.term.raw('----------------------------------------');
  if (issues.length === 0) {
    ctx.term.ok('健康检查通过 ✓');
  } else {
    ctx.term.err(`发现 ${issues.length} 个问题`);
    process.exit(1);
  }
};
