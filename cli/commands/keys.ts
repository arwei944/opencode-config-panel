/**
 * Commands: key list/set/get/delete/export/import
 * 密钥管理
 */

import path from 'node:path';
import os from 'node:os';
import type { CommandHandler } from '../types';
import { redactApiKey } from '../utils';

const KEYS_PATH = path.join(os.homedir(), '.config', 'opencode', '.keys.json');

async function loadKeyStore(fs: import('../types').CliContext['fs']): Promise<Record<string, string>> {
  try { return JSON.parse(await fs.readFile(KEYS_PATH)); } catch { return {}; }
}
async function saveKeyStore(fs: import('../types').CliContext['fs'], store: Record<string, string>): Promise<void> {
  await fs.writeFile(KEYS_PATH, JSON.stringify(store, null, 2));
}

export const keyHandler: CommandHandler = async (args, ctx) => {
  const sub = args[0];

  if (!sub || sub === 'list') {
    const store = await loadKeyStore(ctx.fs);
    if (ctx.options.json) { ctx.term.jsonOut(store); return; }
    if (Object.keys(store).length === 0) { ctx.term.raw('(无密钥)'); return; }
    ctx.term.raw(`密钥 (${Object.keys(store).length}):`);
    for (const [name, key] of Object.entries(store)) {
      ctx.term.raw(`  ${name}: ${redactApiKey(key)}`);
    }
    return;
  }

  if (sub === 'set') {
    const name = args[1];
    if (!name) { ctx.term.err('用法: key set <名称>'); return; }
    if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将存储密钥: ${name}`); if (ctx.options.json) ctx.term.jsonOut({ action: 'key.set', name, dryRun: true }); return; }
    const value = await ctx.prompt.readPassword(`输入密钥值 (${name}): `);
    const store = await loadKeyStore(ctx.fs);
    store[name] = value;
    await saveKeyStore(ctx.fs, store);
    ctx.term.ok(`密钥 ${name} 已存储`);
    if (!ctx.options.dryRun) await ctx.audit.append('key.set', { provider: name });
    if (ctx.options.json) ctx.term.jsonOut({ action: 'key.set', name });
    return;
  }

  if (sub === 'get') {
    const name = args[1];
    if (!name) { ctx.term.err('用法: key get <名称>'); return; }
    const store = await loadKeyStore(ctx.fs);
    if (!store[name]) { ctx.term.err(`密钥 "${name}" 不存在`); return; }
    if (ctx.options.json) { ctx.term.jsonOut({ action: 'key.get', name, value: store[name] }); return; }
    ctx.term.out(store[name]);
    return;
  }

  if (sub === 'delete') {
    const name = args[1];
    if (!name) { ctx.term.err('用法: key delete <名称>'); return; }
    const store = await loadKeyStore(ctx.fs);
    if (!store[name]) { ctx.term.err(`密钥 "${name}" 不存在`); return; }
    if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将删除密钥: ${name}`); if (ctx.options.json) ctx.term.jsonOut({ action: 'key.delete', name, dryRun: true }); return; }
    if (!ctx.options.yes) {
      const ok = await ctx.prompt.confirm(`确认删除密钥 "${name}"？(y/N) `);
      if (!ok) { ctx.term.raw('已取消'); return; }
    }
    delete store[name];
    await saveKeyStore(ctx.fs, store);
    ctx.term.ok(`密钥 ${name} 已删除`);
    if (!ctx.options.dryRun) await ctx.audit.append('key.delete', { provider: name });
    if (ctx.options.json) ctx.term.jsonOut({ action: 'key.delete', name });
    return;
  }

  if (sub === 'export') {
    const exportPath = args[1];
    const redact = args.includes('--redact');
    const store = await loadKeyStore(ctx.fs);
    let output: Record<string, string> = { ...store };
    if (redact) {
      for (const [k, v] of Object.entries(output)) output[k] = redactApiKey(v);
    }
    if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将导出密钥 (${Object.keys(output).length} 个)`); if (ctx.options.json) ctx.term.jsonOut({ action: 'key.export', keys: Object.keys(output).length, dryRun: true }); return; }
    const json = JSON.stringify(output, null, 2);
    if (exportPath && exportPath !== '--redact') {
      await ctx.fs.writeFile(exportPath, json);
      ctx.term.ok(`密钥已导出到 ${exportPath}`);
      if (ctx.options.json) ctx.term.jsonOut({ action: 'key.export', path: exportPath, keys: Object.keys(output).length });
    } else {
      if (ctx.options.json) ctx.term.jsonOut({ action: 'key.export', keys: output });
      else ctx.term.out(json);
    }
    return;
  }

  if (sub === 'import') {
    const importPath = args[1];
    if (!importPath) { ctx.term.err('用法: key import <文件路径>'); return; }
    if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将导入密钥: ${importPath}`); if (ctx.options.json) ctx.term.jsonOut({ action: 'key.import', path: importPath, dryRun: true }); return; }
    const raw = await ctx.fs.readFile(importPath);
    const imported = JSON.parse(raw);
    const store = await loadKeyStore(ctx.fs);
    Object.assign(store, imported);
    await ctx.fs.writeFile(KEYS_PATH, JSON.stringify(store, null, 2));
    ctx.term.ok(`已导入 ${Object.keys(imported).length} 个密钥`);
    if (!ctx.options.dryRun) await ctx.audit.append('key.import', { path: importPath, count: Object.keys(imported).length });
    if (ctx.options.json) ctx.term.jsonOut({ action: 'key.import', path: importPath, imported: Object.keys(imported).length });
    return;
  }

  ctx.term.err('用法: key <list|set|get|delete|export|import> [参数]');
};
