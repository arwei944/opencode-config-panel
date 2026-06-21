/**
 * Commands: get, set, toggle, validate, fmt, export, import
 * 配置读写操作
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { CommandHandler } from '../types';

const AUTH_PATH = path.join(os.homedir(), '.local', 'share', 'opencode', 'auth.json');
const CONFIG_DIR = path.join(os.homedir(), '.config', 'opencode');

/** 检查 auth 文件中是否有指定账户 */
async function hasAuthAccount(providerName: string): Promise<boolean> {
  try {
    const raw = await fs.promises.readFile(AUTH_PATH, 'utf-8');
    const auth = JSON.parse(raw);
    return !!auth[providerName === 'opencode' ? 'agnes-ai' : providerName];
  } catch { return false; }
}

/** 获取配置值 */
export const getHandler: CommandHandler = async (args, ctx) => {
  const key = args[0];
  if (!key) { ctx.term.err('用法: get <键>'); return; }

  if (key === 'providers' || key === 'provider') {
    const providers = await ctx.services.provider.list();
    ctx.term.out(JSON.stringify(providers, null, 2));
    return;
  }

  const config = await ctx.configPort.read();
  const configAny = config as Record<string, unknown>;
  if (key in configAny) {
    const val = configAny[key];
    if (typeof val === 'object' && val !== null) {
      ctx.term.out(JSON.stringify(val, null, 2));
    } else {
      ctx.term.out(String(val));
    }
  } else {
    ctx.term.err(`配置中不存在键 "${key}"`);
  }
};

/** 验证 set 键值 */
function validateSetKey(key: string, rawValue: string, parsedValue: unknown): string[] {
  const warns: string[] = [];
  if (key === 'logLevel') {
    if (!['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(rawValue.toUpperCase())) {
      warns.push(`建议使用 DEBUG/INFO/WARN/ERROR，收到 "${rawValue}"`);
    }
  }
  if ((key === 'model' || key === 'small_model' || key.endsWith('_model')) && typeof parsedValue === 'string') {
    if (!parsedValue.includes('/')) warns.push(`模型名建议格式 provider/model，收到 "${parsedValue}"`);
    if (parsedValue.length > 100) warns.push(`模型名过长: ${parsedValue.length} 字符`);
  }
  return warns;
}

/** 设置配置值 */
export const setHandler: CommandHandler = async (args, ctx) => {
  const key = args[0];
  const val = args.slice(1).join(' ');
  if (!key || !val) { ctx.term.err('用法: set <键> <值>'); return; }

  let parsed: unknown = val;
  if (val === 'true') parsed = true;
  else if (val === 'false') parsed = false;
  else if (/^-?\d+(\.\d+)?$/.test(val)) parsed = parseFloat(val);

  // 验证
  const warns = validateSetKey(key, val, parsed);
  for (const w of warns) ctx.term.warn(w);

  if (ctx.options.dryRun) {
    ctx.term.info(`[DRY-RUN] 将设置: ${key} = ${JSON.stringify(parsed)}`);
    return;
  }

  await ctx.services.config.updateConfig({ [key]: parsed } as Record<string, unknown>);
  ctx.term.ok(`已设置 ${key} = ${JSON.stringify(parsed)}`);
  if (!ctx.options.dryRun) await ctx.audit.append('config.set', { key, value: parsed });
};

/** 切换布尔值 */
export const toggleHandler: CommandHandler = async (args, ctx) => {
  const key = args[0];
  if (!key) { ctx.term.err('用法: toggle <键>'); return; }

  const config = await ctx.configPort.read();
  const configAny = config as Record<string, unknown>;
  const current = configAny[key];

  if (typeof current !== 'boolean') {
    ctx.term.err(`"${key}" 不是布尔值（当前值: ${JSON.stringify(current)}），请用 set 命令设置`);
    return;
  }

  if (ctx.options.dryRun) {
    ctx.term.info(`[DRY-RUN] 将切换: ${key} = ${!current}`);
    return;
  }

  await ctx.services.config.updateConfig({ [key]: !current } as Record<string, unknown>);
  ctx.term.ok(`已切换 ${key}: ${current} → ${!current}`);
};

/** 验证配置 */
export const validateHandler: CommandHandler = async (_args, ctx) => {
  const config = await ctx.configPort.read();
  const result = ctx.services.config.validate(config);

  if (result.valid) {
    const raw = await ctx.fs.readFile(path.join(CONFIG_DIR, 'opencode.json'));
    const size = Buffer.byteLength(raw);
    ctx.term.ok(`配置语法正确 (${(size / 1024).toFixed(1)} KB)`);
  } else {
    ctx.term.err(`配置无效:\n  ${result.errors.join('\n  ')}`);
  }
};

/** 格式化 */
export const formatHandler: CommandHandler = async (_args, ctx) => {
  const config = await ctx.configPort.read();
  if (ctx.options.dryRun) {
    ctx.term.info('[DRY-RUN] 将格式化 opencode.json');
    return;
  }
  await ctx.configPort.write(config);
  ctx.term.ok('已格式化');
};

/** 导出 */
export const exportHandler: CommandHandler = async (args, ctx) => {
  const exportPath = args[0];
  const redact = args.includes('--redact');

  const config = await ctx.configPort.read();

  let output = config;
  if (redact) {
    output = JSON.parse(JSON.stringify(config));
    redactKeys(output as Record<string, unknown>);
  }

  const json = JSON.stringify(output, null, 2);

  if (exportPath && exportPath !== '--redact') {
    await ctx.fs.writeFile(exportPath, json);
    ctx.term.ok(`已导出到 ${exportPath}`);
  } else {
    ctx.term.out(json);
  }
};

function redactKeys(obj: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'apiKey' && typeof v === 'string') {
      obj[k] = v.length <= 8 ? '****' : v.slice(0, 4) + '****' + v.slice(-4);
    } else if (v && typeof v === 'object') {
      redactKeys(v as Record<string, unknown>);
    }
  }
}

/** 导入 */
export const importHandler: CommandHandler = async (args, ctx) => {
  const importPath = args[0];
  const validateOnly = args.includes('--validate-only');
  if (!importPath) { ctx.term.err('用法: import <文件路径> [--validate-only]'); return; }

  const raw = await ctx.fs.readFile(importPath);
  let imported: Record<string, unknown>;
  try { imported = JSON.parse(raw); } catch { ctx.term.err('无效的 JSON 文件'); return; }

  const result = ctx.services.config.validate(imported as never);
  if (!result.valid) {
    ctx.term.err(`导入的配置无效:\n  ${result.errors.join('\n  ')}`);
    return;
  }

  if (ctx.options.dryRun) {
    ctx.term.info('[DRY-RUN] 将导入配置覆盖当前配置');
    if (ctx.options.json) {
      ctx.term.jsonOut({ dryRun: true, willImport: imported });
    }
    return;
  }

  if (validateOnly) {
    ctx.term.ok('配置验证通过，可以导入');
    return;
  }

  await ctx.configPort.write(imported as never);
  ctx.term.ok('配置已导入');
};

/** set-model */
export const setModelHandler: CommandHandler = async (args, ctx) => {
  const model = args[0];
  if (!model) { ctx.term.err('用法: set-model <模型名>'); return; }
  if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将设置 model = ${model}`); return; }
  await ctx.services.config.updateConfig({ model } as Record<string, unknown>);
  ctx.term.ok(`已设置 model = ${model}`);
};

/** set-small-model */
export const setSmallModelHandler: CommandHandler = async (args, ctx) => {
  const model = args[0];
  if (!model) { ctx.term.err('用法: set-small-model <模型名>'); return; }
  if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将设置 small_model = ${model}`); return; }
  await ctx.services.config.updateConfig({ small_model: model } as Record<string, unknown>);
  ctx.term.ok(`已设置 small_model = ${model}`);
};

/** set-default-agent */
export const setDefaultAgentHandler: CommandHandler = async (args, ctx) => {
  const agent = args[0];
  if (!agent) { ctx.term.err('用法: set-default-agent <代理名>'); return; }
  if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将设置 default_agent = ${agent}`); return; }
  await ctx.services.config.updateConfig({ default_agent: agent } as Record<string, unknown>);
  ctx.term.ok(`已设置 default_agent = ${agent}`);
};

/** disabled-providers */
export const disabledProvidersHandler: CommandHandler = async (args, ctx) => {
  const sub = args[0];
  const name = args[1];
  const config = await ctx.configPort.read();

  const key = 'disabledProviders' as const;
  const current = (config as Record<string, unknown>)[key] as string[] | undefined || [];

  if (!sub || sub === 'list') {
    ctx.term.out(`已禁用提供商: ${current.length > 0 ? current.join(', ') : '(无)'}`);
    return;
  }

  if (sub === 'add') {
    if (!name) { ctx.term.err('用法: disabled-providers add <提供商名称>'); return; }
    if (current.includes(name)) { ctx.term.warn(`"${name}" 已禁用`); return; }
    if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将禁用: ${name}`); return; }
    await ctx.services.config.updateConfig({ [key]: [...current, name] } as Record<string, unknown>);
    ctx.term.ok(`已禁用 ${name}`);
  } else if (sub === 'remove') {
    if (!name) { ctx.term.err('用法: disabled-providers remove <提供商名称>'); return; }
    if (!current.includes(name)) { ctx.term.warn(`"${name}" 未禁用`); return; }
    if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将启用: ${name}`); return; }
    await ctx.services.config.updateConfig({ [key]: current.filter((n: string) => n !== name) } as Record<string, unknown>);
    ctx.term.ok(`已启用 ${name}`);
  }
};

/** enabled-providers */
export const enabledProvidersHandler: CommandHandler = async (args, ctx) => {
  const sub = args[0];
  const config = await ctx.configPort.read();
  const key = 'enabledProviders' as const;
  const current = (config as Record<string, unknown>)[key] as string[] | undefined || [];

  if (!sub || sub === 'list') {
    ctx.term.out(`仅限提供商: ${current.length > 0 ? current.join(', ') : '(无，使用全部)'}`);
    return;
  }

  if (sub === 'set') {
    const names = args.slice(1);
    if (names.length === 0) { ctx.term.err('用法: enabled-providers set <名称1> [名称2] ...'); return; }
    if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将设置仅限提供商: ${names.join(', ')}`); return; }
    await ctx.services.config.updateConfig({ [key]: names } as Record<string, unknown>);
    ctx.term.ok(`已设置仅限提供商: ${names.join(', ')}`);
  } else if (sub === 'clear') {
    if (ctx.options.dryRun) { ctx.term.info('[DRY-RUN] 将清除仅限提供商限制'); return; }
    await ctx.services.config.updateConfig({ [key]: [] } as Record<string, unknown>);
    ctx.term.ok('已清除仅限提供商限制');
  }
};
