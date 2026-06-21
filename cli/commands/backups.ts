/**
 * Commands: backup create/list/restore/delete/cleanup/diff/watch
 * 备份管理
 */

import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import type { CommandHandler } from '../types';
import { parseFlags, formatBytes } from '../utils';

const BACKUPS_DIR = path.join(os.homedir(), '.config', 'opencode', 'backups');
const CONFIG_PATH = path.join(os.homedir(), '.config', 'opencode', 'opencode.json');

/** 执行 backup <sub> */
export const backupHandler: CommandHandler = async (args, ctx) => {
  const sub = args[0];

  if (!sub || sub === 'create') {
    const info = await ctx.services.config.createBackupManually();
    ctx.term.ok(`备份已创建: ${info.id}`);
    if (!ctx.options.dryRun) await ctx.audit.append('backup.create', { id: info.id });
    if (ctx.options.json) ctx.term.jsonOut({ action: 'backup.create', id: info.id });
    return;
  }

  if (sub === 'list') {
    const backups = await ctx.backupPort.list();
    if (backups.length === 0) { ctx.term.raw('(无备份)'); return; }
    if (ctx.options.json) {
      ctx.term.jsonOut({ action: 'backup.list', backups: backups.map(b => ({ id: b.id, size: b.size, timestamp: b.timestamp })) });
      return;
    }
    ctx.term.raw(`备份 (${backups.length}):`);
    for (const b of backups) {
      ctx.term.raw(`  ${b.id}  (${formatBytes(b.size || 0)}, ${b.timestamp ? new Date(b.timestamp).toLocaleString() : ''})`);
    }
    return;
  }

  if (sub === 'restore') {
    const id = args[1];
    if (!id) { ctx.term.err('用法: backup restore <备份文件名>'); return; }
    if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将恢复备份: ${id}`); return; }
    try {
      await ctx.services.config.restoreBackup(id);
      ctx.term.ok(`已从 ${id} 恢复`);
      if (!ctx.options.dryRun) await ctx.audit.append('backup.restore', { id });
      if (ctx.options.json) ctx.term.jsonOut({ action: 'backup.restore', id });
    } catch (e) { ctx.term.err(`恢复失败: ${(e as Error).message}`); }
    return;
  }

  if (sub === 'delete') {
    const id = args[1];
    if (!id) { ctx.term.err('用法: backup delete <备份文件名>'); return; }
    try {
      if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将删除: ${id}`); return; }
      await ctx.backupPort.delete(id);
      ctx.term.ok(`备份 ${id} 已删除`);
      if (!ctx.options.dryRun) await ctx.audit.append('backup.delete', { id });
      if (ctx.options.json) ctx.term.jsonOut({ action: 'backup.delete', id });
    } catch (e) { ctx.term.err(`删除失败: ${(e as Error).message}`); }
    return;
  }

  if (sub === 'cleanup') {
    const { flags, provided } = parseFlags(args.slice(1), {
      keep: { type: 'string' },
    });
    if (!provided.has('keep')) {
      ctx.term.err('用法: backup cleanup --keep <N|时间，如 20 或 5d>');
      return;
    }
    const keepSpec = flags.keep as string;
    let keepCount: number | null = null;
    let keepAfter: Date | null = null;

    // 纯数字格式：保留最近 N 个
    if (/^\d+$/.test(keepSpec)) {
      keepCount = parseInt(keepSpec, 10);
    }
    // 时间格式：5d/12h/30m — 保留指定时间内的备份
    else {
      const m = keepSpec.match(/^(\d+)([smhd])$/);
      if (!m) { ctx.term.err('--keep 格式错误，应为数字或 5d/12h/30m'); return; }
      const val = parseInt(m[1], 10);
      const unit = m[2];
      const now = Date.now();
      const ms = unit === 's' ? val * 1000 : unit === 'm' ? val * 60000 : unit === 'h' ? val * 3600000 : val * 86400000;
      keepAfter = new Date(now - ms);
    }

    const backups = await ctx.backupPort.list();
    if (backups.length === 0) { ctx.term.raw('(无备份)'); return; }

    // 按时间排序
    backups.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

    let toDelete: typeof backups = [];
    if (keepCount !== null) {
      // 按数量保留
      toDelete = backups.slice(keepCount);
    } else if (keepAfter !== null) {
      // 按时间保留
      toDelete = backups.filter(b => new Date(b.timestamp || 0) < keepAfter!);
    }

    if (toDelete.length === 0) {
      if (ctx.options.json) ctx.term.jsonOut({ action: 'backup.cleanup', kept: keepCount || keepAfter?.toISOString(), toDelete: 0, ids: [] });
      else ctx.term.ok('无需清理');
      return;
    }

    if (ctx.options.dryRun) {
      for (const b of toDelete) ctx.term.info(`[DRY-RUN] 将删除: ${b.id}`);
      if (ctx.options.json) ctx.term.jsonOut({ action: 'backup.cleanup', dryRun: true, kept: keepCount || keepAfter?.toISOString(), toDelete: toDelete.length, ids: toDelete.map(b => b.id) });
      return;
    }

    // 确认提示
    if (!ctx.options.yes) {
      const ok = await ctx.prompt.confirm(`将删除 ${toDelete.length} 个旧备份，确认？(y/N) `);
      if (!ok) { ctx.term.raw('已取消'); return; }
    }

    let deleted = 0;
    const deletedIds: string[] = [];
    for (const b of toDelete) {
      try { await ctx.backupPort.delete(b.id); deletedIds.push(b.id); deleted++; } catch { /* ignore */ }
    }
    ctx.term.ok(`已清理 ${deleted} 个备份`);
    if (ctx.options.json) ctx.term.jsonOut({ action: 'backup.cleanup', kept: keepCount || keepAfter?.toISOString(), deleted, ids: deletedIds });
    return;
  }

  if (sub === 'diff') {
    const a = args[1], bVal = args[2];
    if (!a || !bVal) { ctx.term.err('用法: backup diff <备份a> <备份b>'); return; }
    const da = await ctx.backupPort.read(a);
    const db = await ctx.backupPort.read(bVal);
    const changes = diffObject(da as Record<string, unknown>, db as Record<string, unknown>);
    if (changes.length === 0) {
      if (ctx.options.json) { ctx.term.jsonOut({ action: 'backup.diff', a, b: bVal, changes: [] }); return; }
      ctx.term.ok('无差异'); return;
    }
    if (ctx.options.json) {
      ctx.term.jsonOut({ action: 'backup.diff', a, b: bVal, changes: changes.slice(0, 200) });
      return;
    }
    ctx.term.raw(`差异 (${a} → ${bVal}): ${changes.length} 项`);
    for (const c of changes.slice(0, 50)) {
      if (c.op === 'add') ctx.term.raw(`  + ${c.path} = ${JSON.stringify(c.newVal)}`);
      else if (c.op === 'remove') ctx.term.raw(`  - ${c.path} = ${JSON.stringify(c.oldVal)}`);
      else ctx.term.raw(`  ~ ${c.path}: ${JSON.stringify(c.oldVal)} → ${JSON.stringify(c.newVal)}`);
    }
    if (changes.length > 50) ctx.term.raw(`  ... 还有 ${changes.length - 50} 项`);
    return;
  }

  if (sub === 'watch') {
    const { flags, provided } = parseFlags(args.slice(1), {
      interval: { type: 'string', default: '10m' },
      keep: { type: 'string', default: '20' },
      once: { type: 'boolean' },
    });
    const intervalRaw = (flags.interval as string) || '10m';
    const m = intervalRaw.match(/^(\d+)([smh])$/);
    if (!m) { ctx.term.err(`--interval 格式错误: ${intervalRaw}`); return; }
    const ms = parseInt(m[1], 10) * (m[2] === 's' ? 1000 : m[2] === 'm' ? 60000 : 3600000);
    const once = !!flags.once;

    ctx.term.info(`开始监听配置文件，每 ${intervalRaw} 检测一次 (保留 ${flags.keep})${ctx.options.dryRun ? ' [DRY-RUN]' : ''}`);
    let lastHash = '';
    let lastBackupName: string | null = null;
    let backupsCreated = 0;

    const tick = async () => {
      try {
        if (!(await ctx.fs.exists(CONFIG_PATH))) { return; }
        const content = await ctx.fs.readFile(CONFIG_PATH);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        if (hash !== lastHash) {
          if (lastHash !== '') {
            if (ctx.options.dryRun) {
              const ts = new Date().toISOString().replace(/[:.]/g, '-');
              ctx.term.info(`[DRY-RUN] 检测到变更，应备份到: opencode-${ts}.json (大小 ${Buffer.byteLength(content)} 字节)`);
            } else {
              const info = await ctx.services.config.createBackupManually();
              ctx.term.ok(`自动备份: ${info.id}`);
              if (!ctx.options.dryRun) await ctx.audit.append('backup.create', { id: info.id, auto: true });
              backupsCreated++;
            }
          }
          lastHash = hash;
        }
      } catch (e) { ctx.term.warn(`监听错误: ${(e as Error).message}`); }
    };

    await tick();
    if (once) {
      ctx.term.info(`一次性检测完成 (backups=${backupsCreated})`);
      return;
    }

    const timer = setInterval(tick, ms);
    ctx.term.info('按 Ctrl+C 可停止监听');
    await new Promise(() => {});
  }

  ctx.term.err('用法: backup <create|list|restore|delete|cleanup|diff|watch> [参数]');
};

/** 对比两个对象 */
function diffObject(a: Record<string, unknown>, b: Record<string, unknown>, pathPrefix = ''): Array<{ op: string; path: string; oldVal?: unknown; newVal?: unknown }> {
  const changes: Array<{ op: string; path: string; oldVal?: unknown; newVal?: unknown }> = [];
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of allKeys) {
    const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    if (!(key in a)) {
      changes.push({ op: 'add', path: currentPath, newVal: b[key] });
    } else if (!(key in b)) {
      changes.push({ op: 'remove', path: currentPath, oldVal: a[key] });
    } else if (typeof a[key] === 'object' && typeof b[key] === 'object' && a[key] !== null && b[key] !== null) {
      changes.push(...diffObject(a[key] as Record<string, unknown>, b[key] as Record<string, unknown>, currentPath));
    } else if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
      changes.push({ op: 'change', path: currentPath, oldVal: a[key], newVal: b[key] });
    }
  }
  return changes;
}

/** 回滚 */
export const rollbackHandler: CommandHandler = async (args, ctx) => {
  const backups = await ctx.backupPort.list();
  if (backups.length === 0) { ctx.term.raw('没有可用的备份，无法回滚'); return; }
  backups.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

  const { flags } = parseFlags(args, {
    latest: { type: 'boolean', alias: 'l' },
  });

  if (flags.latest || args[0] === '--latest' || args[0] === '-l') {
    if (ctx.options.dryRun) {
      ctx.term.info(`[DRY-RUN] 将回滚到最新备份: ${backups[0].id}`);
      if (ctx.options.json) ctx.term.jsonOut({ action: 'rollback', target: backups[0].id, dryRun: true });
      return;
    }
    const latest = backups[0];
    await ctx.services.config.restoreBackup(latest.id);
    ctx.term.ok(`已回滚到最新备份: ${latest.id}`);
    if (!ctx.options.dryRun) await ctx.audit.append('rollback.restore', { target: latest.id });
    if (ctx.options.json) ctx.term.jsonOut({ action: 'rollback', target: latest.id });
    return;
  }

  const targetId = args[0];
  if (targetId) {
    const found = backups.find(b => b.id === targetId);
    if (!found) { ctx.term.err(`备份 "${targetId}" 不存在`); return; }
    if (ctx.options.dryRun) {
      ctx.term.info(`[DRY-RUN] 将回滚到: ${targetId}`);
      if (ctx.options.json) ctx.term.jsonOut({ action: 'rollback', target: targetId, dryRun: true });
      return;
    }
    await ctx.services.config.restoreBackup(found.id);
    ctx.term.ok(`已回滚到: ${found.id}`);
    if (!ctx.options.dryRun) await ctx.audit.append('rollback.restore', { target: found.id });
    if (ctx.options.json) ctx.term.jsonOut({ action: 'rollback', target: found.id });
    return;
  }

  // 交互选择
  if (ctx.options.dryRun) {
    ctx.term.raw('可选备份:');
    for (let i = 0; i < Math.min(backups.length, 20); i++) {
      ctx.term.raw(`  [${i + 1}] ${backups[i].id} (${formatBytes(backups[i].size || 0)})`);
    }
    ctx.term.info('[DRY-RUN] 跳过交互选择');
    if (ctx.options.json) ctx.term.jsonOut({ action: 'rollback', dryRun: true, backups: backups.slice(0, 20).map(b => b.id) });
    return;
  }
  ctx.term.raw('可选备份:');
  for (let i = 0; i < Math.min(backups.length, 20); i++) {
    ctx.term.raw(`  [${i + 1}] ${backups[i].id} (${formatBytes(backups[i].size || 0)})`);
  }
  const answer = await ctx.prompt.readLine('选择要回滚的备份编号 (1-20) 或按回车取消: ');
  const idx = parseInt(answer, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= Math.min(backups.length, 20)) { ctx.term.raw('已取消'); return; }
  await ctx.services.config.restoreBackup(backups[idx].id);
  ctx.term.ok(`已回滚到: ${backups[idx].id}`);
  if (!ctx.options.dryRun) await ctx.audit.append('rollback.restore', { target: backups[idx].id });
  if (ctx.options.json) ctx.term.jsonOut({ action: 'rollback', target: backups[idx].id });
};

/** diff 命令 */
export const diffHandler: CommandHandler = async (args, ctx) => {
  const sub = args[0];
  const fileA = args[1];
  const fileB = args[2];

  if (sub === 'import') {
    if (!fileA) { ctx.term.err('用法: diff import <文件>'); return; }
    const config = await ctx.configPort.read();
    const raw = await ctx.fs.readFile(fileA);
    const imported = JSON.parse(raw);
    const changes = diffObject(config as Record<string, unknown>, imported as Record<string, unknown>);
    if (ctx.options.json) { ctx.term.jsonOut({ action: 'diff.import', file: fileA, changes, count: changes.length }); return; }
    if (changes.length === 0) { ctx.term.ok('无差异'); return; }
    ctx.term.raw(`与 ${fileA} 差异: ${changes.length} 项`);
    for (const c of changes.slice(0, 50)) {
      if (c.op === 'add') ctx.term.raw(`  + ${c.path} = ${JSON.stringify(c.newVal)}`);
      else if (c.op === 'remove') ctx.term.raw(`  - ${c.path} = ${JSON.stringify(c.oldVal)}`);
      else ctx.term.raw(`  ~ ${c.path}: ${JSON.stringify(c.oldVal)} → ${JSON.stringify(c.newVal)}`);
    }
    return;
  }

  if (sub === 'rollback') {
    if (!fileA) { ctx.term.err('用法: diff rollback <备份>'); return; }
    const config = await ctx.configPort.read();
    const backupConfig = await ctx.backupPort.read(fileA);
    const changes = diffObject(config as Record<string, unknown>, backupConfig as Record<string, unknown>);
    if (ctx.options.json) { ctx.term.jsonOut({ action: 'diff.rollback', backup: fileA, changes, count: changes.length }); return; }
    if (changes.length === 0) { ctx.term.ok('无差异'); return; }
    ctx.term.raw(`与备份 ${fileA} 差异: ${changes.length} 项`);
    for (const c of changes.slice(0, 50)) {
      if (c.op === 'add') ctx.term.raw(`  + ${c.path} = ${JSON.stringify(c.newVal)}`);
      else if (c.op === 'remove') ctx.term.raw(`  - ${c.path} = ${JSON.stringify(c.oldVal)}`);
      else ctx.term.raw(`  ~ ${c.path}: ${JSON.stringify(c.oldVal)} → ${JSON.stringify(c.newVal)}`);
    }
    return;
  }

  if (!fileA || !fileB) { ctx.term.err('用法: diff <文件a> <文件b>'); return; }
  const rawA = await ctx.fs.readFile(fileA);
  const rawB = await ctx.fs.readFile(fileB);
  const objA = JSON.parse(rawA);
  const objB = JSON.parse(rawB);
  const changes = diffObject(objA, objB);
  if (ctx.options.json) { ctx.term.jsonOut({ action: 'diff', fileA, fileB, changes, count: changes.length }); return; }
  if (changes.length === 0) { ctx.term.ok('无差异'); return; }
  ctx.term.raw(`差异 (${fileA} ↔ ${fileB}): ${changes.length} 项`);
  for (const c of changes.slice(0, 50)) {
    if (c.op === 'add') ctx.term.raw(`  + ${c.path} = ${JSON.stringify(c.newVal)}`);
    else if (c.op === 'remove') ctx.term.raw(`  - ${c.path} = ${JSON.stringify(c.oldVal)}`);
    else ctx.term.raw(`  ~ ${c.path}: ${JSON.stringify(c.oldVal)} → ${JSON.stringify(c.newVal)}`);
  }
};
