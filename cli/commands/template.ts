/**
 * Commands: template list/save/apply/show/delete/export/import
 * 模板管理
 */

import path from 'node:path';
import os from 'node:os';
import type { CommandHandler } from '../types';
import { parseFlags, topKeys } from '../utils';

const TEMPLATES_DIR = path.join(os.homedir(), '.config', 'opencode', 'templates');

export const templateHandler: CommandHandler = async (args, ctx) => {
  const sub = args[0];

  if (!sub || sub === 'list') {
    await ctx.fs.ensureDir(TEMPLATES_DIR);
    const entries = await ctx.fs.readDir(TEMPLATES_DIR);
    const names = entries.filter(e => e.isFile && e.name.endsWith('.json')).map(e => e.name.replace(/\.json$/, ''));
    if (ctx.options.json) { ctx.term.jsonOut({ action: 'template.list', templates: names }); return; }
    if (names.length === 0) { ctx.term.raw('(无模板)'); return; }
    ctx.term.raw(`模板 (${names.length}):`);
    for (const n of names) ctx.term.raw(`  ${n}`);
    return;
  }

  if (sub === 'save') {
    const name = args[1];
    if (!name) { ctx.term.err('用法: template save <名称>'); return; }
    if (!/^[a-z0-9-]{2,32}$/.test(name)) { ctx.term.err('非法模板名: 必须为小写字母、数字、连字符，2-32 字符'); return; }

    const config = await ctx.configPort.read();
    const existing = await (async () => {
      try { return JSON.parse(await ctx.fs.readFile(path.join(TEMPLATES_DIR, `${name}.json`))); } catch { return null; }
    })();

    if (ctx.options.dryRun) {
      ctx.term.info(`[DRY-RUN] 将保存模板: ${name} (overwrite=${!!existing})`);
      if (ctx.options.json) {
        ctx.term.jsonOut({
          action: 'template.save',
          name,
          exists: !!existing,
          wouldCreateDir: true,
          keys: topKeys(config as Record<string, unknown>),
          size: Buffer.byteLength(JSON.stringify(config)),
        });
      }
      return;
    }

    await ctx.fs.ensureDir(TEMPLATES_DIR);
    await ctx.fs.writeFile(path.join(TEMPLATES_DIR, `${name}.json`), JSON.stringify(config, null, 2));
    if (existing) ctx.term.info(`模板 "${name}" 已覆盖`);
    else ctx.term.ok(`模板 "${name}" 已保存`);
    if (!ctx.options.dryRun) await ctx.audit.append('template.save', { name, overwrite: !!existing });
    return;
  }

  if (sub === 'apply') {
    const name = args[1];
    if (!name) { ctx.term.err('用法: template apply <名称>'); return; }
    const templatePath = path.join(TEMPLATES_DIR, `${name}.json`);
    if (!await ctx.fs.exists(templatePath)) { ctx.term.err(`模板 "${name}" 不存在`); return; }
    const template = JSON.parse(await ctx.fs.readFile(templatePath));
    if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将应用模板: ${name}`); if (ctx.options.json) ctx.term.jsonOut({ action: 'template.apply', name, dryRun: true }); return; }
    await ctx.configPort.write(template);
    ctx.term.ok(`已应用模板: ${name}`);
    if (!ctx.options.dryRun) await ctx.audit.append('template.apply', { name });
    if (ctx.options.json) ctx.term.jsonOut({ action: 'template.apply', name });
    return;
  }

  if (sub === 'show') {
    const name = args[1];
    if (!name) { ctx.term.err('用法: template show <名称>'); return; }
    const templatePath = path.join(TEMPLATES_DIR, `${name}.json`);
    if (!await ctx.fs.exists(templatePath)) { ctx.term.err(`模板 "${name}" 不存在`); return; }
    const content = await ctx.fs.readFile(templatePath);
    ctx.term.out(content);
    return;
  }

  if (sub === 'delete') {
    const name = args[1];
    if (!name) { ctx.term.err('用法: template delete <名称>'); return; }
    const templatePath = path.join(TEMPLATES_DIR, `${name}.json`);
    if (!await ctx.fs.exists(templatePath)) { ctx.term.err(`模板 "${name}" 不存在`); return; }
    if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将删除模板: ${name}`); return; }
    if (!ctx.options.yes) {
      const ok = await ctx.prompt.confirm(`确认删除模板 "${name}"？(y/N) `);
      if (!ok) { ctx.term.raw('已取消'); return; }
    }
    await ctx.fs.deleteFile(templatePath);
    ctx.term.ok(`模板 "${name}" 已删除`);
    if (!ctx.options.dryRun) await ctx.audit.append('template.delete', { name });
    return;
  }

  if (sub === 'export') {
    const name = args[1];
    const exportPath = args[2];
    if (!name) { ctx.term.err('用法: template export <名称> [目标路径]'); return; }
    const templatePath = path.join(TEMPLATES_DIR, `${name}.json`);
    if (!await ctx.fs.exists(templatePath)) { ctx.term.err(`模板 "${name}" 不存在`); return; }
    const content = await ctx.fs.readFile(templatePath);
    if (exportPath) {
      await ctx.fs.writeFile(exportPath, content);
      ctx.term.ok(`已导出到 ${exportPath}`);
      if (ctx.options.json) ctx.term.jsonOut({ action: 'template.export', name, path: exportPath });
    } else {
      if (ctx.options.json) ctx.term.jsonOut({ action: 'template.export', name, content: JSON.parse(content) });
      else ctx.term.out(content);
    }
    return;
  }

  if (sub === 'import') {
    const importPath = args[1];
    if (!importPath) { ctx.term.err('用法: template import <文件路径>'); return; }
    if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将导入模板: ${importPath}`); if (ctx.options.json) ctx.term.jsonOut({ action: 'template.import', source: importPath, dryRun: true }); return; }
    const raw = await ctx.fs.readFile(importPath);
    const name = path.basename(importPath, '.json');
    await ctx.fs.ensureDir(TEMPLATES_DIR);
    await ctx.fs.writeFile(path.join(TEMPLATES_DIR, `${name}.json`), raw);
    ctx.term.ok(`模板已导入: ${name}`);
    if (!ctx.options.dryRun) await ctx.audit.append('template.import', { name, source: importPath });
    if (ctx.options.json) ctx.term.jsonOut({ action: 'template.import', name, source: importPath });
    return;
  }

  ctx.term.err('用法: template <list|save|apply|show|delete|export|import> [参数]');
};

/** profile 命令 */
export const profileHandler: CommandHandler = async (args, ctx) => {
  const sub = args[0];
  const PROFILES_DIR = path.join(os.homedir(), '.config', 'opencode', 'profiles');
  const ACTIVE_PROFILE_PATH = path.join(os.homedir(), '.config', 'opencode', '.active-profile');

  async function getActiveProfileName(): Promise<string | null> {
    try {
      const raw = await ctx.fs.readFile(ACTIVE_PROFILE_PATH);
      const trimmed = raw.trim();
      if (!trimmed) return null;
      try { return (JSON.parse(trimmed) as { name?: string }).name || trimmed; }
      catch { return trimmed; }
    } catch { return null; }
  }

  if (!sub || sub === 'list') {
    await ctx.fs.ensureDir(PROFILES_DIR);
    const active = await getActiveProfileName();
    const entries = await ctx.fs.readDir(PROFILES_DIR);
    const names = entries.filter(e => e.isFile && e.name.endsWith('.json')).map(e => e.name.replace(/\.json$/, ''));
    if (ctx.options.json) { ctx.term.jsonOut({ action: 'profile.list', profiles: names, active }); return; }
    if (names.length === 0) { ctx.term.raw('(无 profile)'); return; }
    ctx.term.raw(`Profiles (${names.length}):${active ? ` [当前: ${active}]` : ''}`);
    for (const n of names) ctx.term.raw(`  ${n}${n === active ? ' ← 当前' : ''}`);
    return;
  }

  if (sub === 'save') {
    const name = args[1];
    if (!name) { ctx.term.err('用法: profile save <名称>'); return; }
    if (!/^[a-z0-9-]{2,32}$/.test(name)) { ctx.term.err('Profile 名称必须为小写字母、数字、连字符，2-32 字符'); return; }

    const config = await ctx.configPort.read();
    const existing = await (async () => {
      try { return JSON.parse(await ctx.fs.readFile(path.join(PROFILES_DIR, `${name}.json`))); } catch { return null; }
    })();

    if (ctx.options.dryRun) {
      ctx.term.info(`[DRY-RUN] 将保存 profile: ${name} (overwrite=${!!existing})`);
      if (ctx.options.json) ctx.term.jsonOut({ action: 'profile.save', name, exists: !!existing });
      return;
    }

    await ctx.fs.ensureDir(PROFILES_DIR);
    await ctx.fs.writeFile(path.join(PROFILES_DIR, `${name}.json`), JSON.stringify(config, null, 2));
    ctx.term.ok(`Profile "${name}" 已保存`);
    if (!ctx.options.dryRun) await ctx.audit.append('profile.save', { name, overwrite: !!existing });
    return;
  }

  if (sub === 'use') {
    const name = args[1];
    if (!name) { ctx.term.err('用法: profile use <名称>'); return; }
    const profilePath = path.join(PROFILES_DIR, `${name}.json`);
    if (!await ctx.fs.exists(profilePath)) { ctx.term.err(`Profile "${name}" 不存在`); return; }

    const config = JSON.parse(await ctx.fs.readFile(profilePath));

    if (ctx.options.dryRun) {
      ctx.term.info(`[DRY-RUN] 将切换 profile: ${name}`);
      if (ctx.options.json) ctx.term.jsonOut({ action: 'profile.use', name, topKeys: topKeys(config as Record<string, unknown>) });
      return;
    }

    // 写入 .active-profile（JSON 对象格式）
    await ctx.fs.writeFile(ACTIVE_PROFILE_PATH, JSON.stringify({ name }));
    ctx.term.ok(`已切换到 profile: ${name}`);
    if (!ctx.options.dryRun) await ctx.audit.append('profile.use', { name });
    return;
  }

  if (sub === 'show') {
    const name = args[1];
    if (!name) { ctx.term.err('用法: profile show <名称>'); return; }
    const profilePath = path.join(PROFILES_DIR, `${name}.json`);
    if (!await ctx.fs.exists(profilePath)) { ctx.term.err(`Profile "${name}" 不存在`); return; }
    const content = await ctx.fs.readFile(profilePath);
    if (ctx.options.json) { ctx.term.jsonOut({ action: 'profile.show', name, profile: JSON.parse(content) }); return; }
    ctx.term.out(content);
    return;
  }

  if (sub === 'delete') {
    const name = args[1];
    if (!name) { ctx.term.err('用法: profile delete <名称>'); return; }
    const profilePath = path.join(PROFILES_DIR, `${name}.json`);
    if (!await ctx.fs.exists(profilePath)) { ctx.term.err(`Profile "${name}" 不存在`); return; }

    const active = await getActiveProfileName();

    if (ctx.options.dryRun) {
      ctx.term.info(`[DRY-RUN] 将删除 profile: ${name} (isActive=${name === active})`);
      if (ctx.options.json) ctx.term.jsonOut({ action: 'profile.delete', name, isActive: name === active });
      return;
    }

    if (!ctx.options.yes) {
      const ok = await ctx.prompt.confirm(`确认删除 profile "${name}"？(y/N) `);
      if (!ok) { ctx.term.raw('已取消'); return; }
    }

    await ctx.fs.deleteFile(profilePath);
    ctx.term.ok(`Profile "${name}" 已删除`);
    if (name === active) {
      try { await ctx.fs.deleteFile(ACTIVE_PROFILE_PATH); } catch { /* ignore */ }
      ctx.term.info('当前激活的 profile 已被清除');
    }
    if (!ctx.options.dryRun) await ctx.audit.append('profile.delete', { name, wasActive: name === active });
    return;
  }

  if (sub === 'export') {
    const name = args[1];
    const exportPath = args[2];
    if (!name) { ctx.term.err('用法: profile export <名称> [目标路径]'); return; }
    const profilePath = path.join(PROFILES_DIR, `${name}.json`);
    if (!await ctx.fs.exists(profilePath)) { ctx.term.err(`Profile "${name}" 不存在`); return; }
    const content = await ctx.fs.readFile(profilePath);
    if (exportPath) {
      await ctx.fs.writeFile(exportPath, content);
      ctx.term.ok(`已导出到 ${exportPath}`);
      if (ctx.options.json) ctx.term.jsonOut({ action: 'profile.export', name, path: exportPath });
    } else {
      if (ctx.options.json) ctx.term.jsonOut({ action: 'profile.export', name, profile: JSON.parse(content) });
      else ctx.term.out(content);
    }
    return;
  }

  if (sub === 'import') {
    const importPath = args[1];
    if (!importPath) { ctx.term.err('用法: profile import <文件路径>'); return; }
    const raw = await ctx.fs.readFile(importPath);
    const name = path.basename(importPath, '.json');
    await ctx.fs.ensureDir(PROFILES_DIR);
    await ctx.fs.writeFile(path.join(PROFILES_DIR, `${name}.json`), raw);
    ctx.term.ok(`Profile 已导入: ${name}`);
    if (ctx.options.json) ctx.term.jsonOut({ action: 'profile.import', name, source: importPath });
    return;
  }

  ctx.term.err('用法: profile <list|save|use|show|delete|export|import> [参数]');
};
