/**
 * Command: status
 * 显示配置概览
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { CommandHandler } from '../types';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'opencode');
const CONFIG_PATH = path.join(CONFIG_DIR, 'opencode.json');
const AUTH_PATH = path.join(os.homedir(), '.local', 'share', 'opencode', 'auth.json');
const AGENTS_DIR = path.join(CONFIG_DIR, 'agents');
const SKILLS_DIR = path.join(CONFIG_DIR, 'skills');
const ACCOUNT_TO_PROVIDER: Record<string, string> = { 'agnes-ai': 'opencode' };
const OPENCODE_MODELS = ['big-pickle', 'deepseek-v4-flash-free', 'mimo-v2.5-free', 'nemotron-3-ultra-free', 'north-mini-code-free'];

export const statusHandler: CommandHandler = async (_args, ctx) => {
  const config = await ctx.configPort.read();

  const jsonProviders = Object.keys(config.provider || {}).length;
  let authProviders = 0;
  try {
    const auth = JSON.parse(await ctx.fs.readFile(AUTH_PATH));
    if (auth) authProviders = Object.keys(auth).length;
  } catch { /* ignore */ }
  const totalProviders = jsonProviders + authProviders;

  let modelCount = 0;
  if (config.provider) {
    for (const p of Object.values(config.provider) as Array<{ models?: Record<string, unknown> }>) {
      if (p.models) modelCount += Object.keys(p.models).length;
    }
  }
  let hasOpencode = !!(config.provider as Record<string, { models?: unknown }> | undefined)?.['opencode'];
  if (!hasOpencode) {
    try {
      const auth = JSON.parse(await ctx.fs.readFile(AUTH_PATH));
      hasOpencode = !!(auth?.['agnes-ai']);
    } catch { /* ignore */ }
  }
  if (hasOpencode) {
    const opencodeProvider = (config.provider as Record<string, { models?: Record<string, unknown> }> | undefined)?.['opencode'];
    if (!opencodeProvider?.models) modelCount += OPENCODE_MODELS.length;
  }

  let agentDirCount = 0;
  try { agentDirCount = (await ctx.fs.readDir(AGENTS_DIR)).filter(f => f.name.endsWith('.md')).length; } catch { /* ignore */ }
  const agentCount = Math.max(Object.keys(config.agent || {}).length, agentDirCount);

  let skillCount = 0;
  try {
    const dirs = await ctx.fs.readDir(SKILLS_DIR);
    for (const d of dirs) {
      if (d.isDirectory) {
        try {
          await ctx.fs.stat(path.join(SKILLS_DIR, d.name, 'SKILL.md'));
          skillCount++;
        } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }

  const mcpCount = Object.keys(config.mcp || {}).length;
  const toolCount = Object.keys(config.tools || {}).length;

  let fileSize = 0;
  try { fileSize = (await ctx.fs.stat(CONFIG_PATH)).size; } catch { /* ignore */ }

  if (ctx.options.json) {
    ctx.term.jsonOut({
      configPath: CONFIG_PATH,
      configSize: (fileSize / 1024).toFixed(1) + ' KB',
      providers: totalProviders,
      models: modelCount,
      agents: agentCount,
      skills: skillCount,
      mcp: mcpCount,
      tools: toolCount,
      model: config.model || null,
      small_model: config.small_model || null,
      default_agent: config.default_agent || null,
      providerNames: config.provider ? Object.keys(config.provider as Record<string, unknown>) : [],
    });
    return;
  }

  ctx.term.raw('========================================');
  ctx.term.raw('  Opencode 配置概览');
  ctx.term.raw('========================================');
  ctx.term.raw(`  配置文件: ${CONFIG_PATH}`);
  ctx.term.raw(`  配置文件大小: ${(fileSize / 1024).toFixed(1)} KB`);
  ctx.term.raw(`  提供商: ${totalProviders}`);
  ctx.term.raw(`  模型: ${modelCount}`);
  ctx.term.raw(`  代理: ${agentCount}`);
  ctx.term.raw(`  技能: ${skillCount}`);
  ctx.term.raw(`  MCP 服务器: ${mcpCount}`);
  ctx.term.raw(`  工具: ${toolCount}`);
  ctx.term.raw('----------------------------------------');
  ctx.term.raw(`  model:        ${config.model || '(未设置)'}`);
  ctx.term.raw(`  small_model:  ${config.small_model || '(未设置)'}`);
  ctx.term.raw(`  default_agent: ${config.default_agent || '(未设置)'}`);
  ctx.term.raw('----------------------------------------');
  ctx.term.raw('  提供商列表:');
  if (config.provider) {
    for (const name of Object.keys(config.provider as Record<string, unknown>)) {
      ctx.term.raw(`    - ${name}`);
    }
  }
  try {
    const auth = JSON.parse(await ctx.fs.readFile(AUTH_PATH));
    if (auth) {
      for (const acct of Object.keys(auth)) {
        const pName = ACCOUNT_TO_PROVIDER[acct] || acct;
        if (!config.provider || !((config.provider as Record<string, unknown>)[pName])) {
          ctx.term.raw(`    - ${pName} [凭证账户: ${acct}]`);
        }
      }
    }
  } catch { /* ignore */ }
  ctx.term.raw('========================================');
};
