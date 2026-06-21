/**
 * 剩余命令：log, json, skills, mcp, tool, server, plugin, reference,
 * command-custom, compaction, tool-output, experimental, attachment, ui, self
 */

import path from 'node:path';
import os from 'node:os';
import type { CommandHandler, CliContext } from '../types';
import { parseFlags } from '../utils';

// ============================================================
// 审计日志
// ============================================================
export const logHandler: CommandHandler = async (args, ctx) => {
  const sub = args[0];
  if (sub === 'clear') {
    if (ctx.options.dryRun) { ctx.term.info('[DRY-RUN] 将清空审计日志'); return; }
    await ctx.audit.clear();
    ctx.term.ok('审计日志已清空');
    return;
  }

  const tail = parseInt((args[1] || '20'), 10);
  const entries = await ctx.audit.tail(tail);

  if (ctx.options.json) { ctx.term.jsonOut(entries); return; }

  if (entries.length === 0) { ctx.term.raw('(无审计日志)'); return; }
  ctx.term.raw(`审计日志 (最近 ${entries.length} 条):`);
  for (const e of entries) {
    ctx.term.raw(`  ${e.time}  ${e.action}${e.detail ? ' ' + JSON.stringify(e.detail) : ''}`);
  }
};

// ============================================================
// JSON 直接操作
// ============================================================
export const jsonHandler: CommandHandler = async (args, ctx) => {
  const sub = args[0];
  if (!sub) { ctx.term.err('用法: json <get|set|patch> <路径> [值]'); return; }

  const config = await ctx.configPort.read();

  if (sub === 'get') {
    const jsonPath = args[1];
    if (!jsonPath) { ctx.term.err('用法: json get <路径>'); return; }
    const keys = jsonPath.split('.');
    let val: unknown = config as Record<string, unknown>;
    for (const k of keys) {
      if (val && typeof val === 'object' && k in (val as Record<string, unknown>)) {
        val = (val as Record<string, unknown>)[k];
      } else {
        ctx.term.err(`路径 "${jsonPath}" 不存在`);
        return;
      }
    }
    ctx.term.out(JSON.stringify(val, null, 2));
    return;
  }

  if (sub === 'set') {
    const jsonPath = args[1];
    const rawVal = args.slice(2).join(' ');
    if (!jsonPath || !rawVal) { ctx.term.err('用法: json set <路径> <值>'); return; }

    let parsedVal: unknown = rawVal;
    if (rawVal === 'true') parsedVal = true;
    else if (rawVal === 'false') parsedVal = false;
    else if (/^-?\d+(\.\d+)?$/.test(rawVal)) parsedVal = parseFloat(rawVal);
    else { try { parsedVal = JSON.parse(rawVal); } catch { /* keep as string */ } }

    const keys = jsonPath.split('.');
    const lastKey = keys.pop()!;
    let current: Record<string, unknown> = { ...config as Record<string, unknown> };
    let ptr = current;
    for (const k of keys) {
      if (!(k in ptr) || typeof ptr[k] !== 'object') ptr[k] = {};
      ptr[k] = { ...(ptr[k] as Record<string, unknown>) };
      ptr = ptr[k] as Record<string, unknown>;
    }

    if (ctx.options.dryRun) {
      ctx.term.info(`[DRY-RUN] json set ${jsonPath} = ${JSON.stringify(parsedVal)}`);
      if (ctx.options.json) ctx.term.jsonOut({ dryRun: true, key: jsonPath, value: parsedVal });
      return;
    }

    ptr[lastKey] = parsedVal;
    await ctx.configPort.write(current as never);
    ctx.term.ok(`已设置 ${jsonPath} = ${JSON.stringify(parsedVal)}`);
    if (!ctx.options.dryRun) await ctx.audit.append('json.set', { path: jsonPath, value: parsedVal });
    return;
  }

  if (sub === 'patch') {
    const jsonPath = args[1];
    const patchArg = args.slice(2).join(' ');
    if (!jsonPath || !patchArg) { ctx.term.err('用法: json patch <路径> <{op,value}>'); return; }

    let patch: { op: string; value: unknown };
    try { patch = JSON.parse(patchArg); } catch { ctx.term.err('patch 参数必须是 JSON 对象 {op,value}'); return; }

    const configObj = config as Record<string, unknown>;
    const keys = jsonPath.split('.');
    const lastKey = keys.pop()!;
    const parentKeys = [...keys];
    let current = configObj;
    for (const k of keys) {
      if (!(k in current) || typeof current[k] !== 'object') {
        if (patch.op === 'add' || patch.op === 'replace') current[k] = {};
        else { ctx.term.err(`路径 "${jsonPath}" 不存在`); return; }
      }
      current = current[k] as Record<string, unknown>;
    }

    if (ctx.options.dryRun) {
      ctx.term.info(`[DRY-RUN] json patch ${jsonPath}: ${patch.op}`);
      if (ctx.options.json) ctx.term.jsonOut({ dryRun: true, key: jsonPath, patch });
      return;
    }

    switch (patch.op) {
      case 'add':
      case 'replace':
        current[lastKey] = patch.value;
        break;
      case 'remove':
        delete current[lastKey];
        break;
      default:
        ctx.term.err(`不支持的操作: ${patch.op}`);
        return;
    }

    await ctx.configPort.write(configObj as never);
    ctx.term.ok(`已执行 json patch: ${jsonPath} (${patch.op})`);
    if (!ctx.options.dryRun) await ctx.audit.append('json.patch', { path: jsonPath, op: patch.op });
    return;
  }

  ctx.term.err('用法: json <get|set|patch> <路径> [值]');
};

// ============================================================
// Skills 管理（完整实现）
// ============================================================
const SKILLS_DIR = path.join(os.homedir(), '.config', 'opencode', 'skills');

/** 验证技能名 */
function validateSkillName(name: string): boolean {
  return /^[a-z0-9-]{2,32}$/.test(name);
}

export const skillsHandler: CommandHandler = async (args, ctx) => {
  const sub = args[0];

  // ── list ──────────────────────────────────────────────
  if (!sub || sub === 'list') {
    const { flags } = parseFlags(args.slice(1), { verbose: { type: 'boolean', alias: 'v' } });
    const result = await ctx.services.skill.scan();

    if (result.skills.length === 0) { ctx.term.raw('(无技能)'); return; }

    if (ctx.options.json) {
      ctx.term.jsonOut({
        action: 'skills.list',
        skills: result.skills.map(s => ({
          name: s.name,
          description: s.description,
          license: s.license,
          compatibility: s.compatibility,
          severity: s.severity,
          persistence: s.persistence,
          enabled: s.enabled,
        })),
      });
      return;
    }

    if (flags.verbose) {
      for (const s of result.skills) {
        const parts = [`  ${s.name}`];
        if (s.description) parts.push(`description=${s.description}`);
        if (s.license) parts.push(`license=${s.license}`);
        if (s.severity) parts.push(`severity=${s.severity}`);
        if (s.persistence) parts.push(`persistence=${s.persistence}`);
        ctx.term.raw(parts.join('  '));
      }
    } else {
      for (const s of result.skills) {
        ctx.term.raw(`  ${s.name}${s.description ? ` — ${s.description}` : ''}`);
      }
    }
    ctx.term.raw(`技能 (${result.skills.length})`);
    return;
  }

  // ── doctor ───────────────────────────────────────────
  if (sub === 'doctor') {
    const result = await ctx.services.skill.scan();
    const issues: string[] = [];
    for (const s of result.skills) {
      if (!s.description) issues.push(`${s.name}: 缺少 description`);
    }

    if (ctx.options.json) {
      ctx.term.jsonOut({
        action: 'skills.doctor',
        total: result.skills.length,
        issues,
        healthy: issues.length === 0,
      });
      return;
    }

    ctx.term.ok(`共 ${result.skills.length} 个技能`);
    for (const i of issues) ctx.term.warn(i);
    return;
  }

  // ── create ───────────────────────────────────────────
  if (sub === 'create') {
    const name = args[1];
    if (!name) { ctx.term.err('用法: skills create <名称> [--path <路径> | --url <URL>] [--description <描述>]'); return; }
    if (!validateSkillName(name)) { ctx.term.err(`非法技能名: 必须为小写字母、数字、连字符，2-32 字符`); return; }

    const { flags } = parseFlags(args.slice(2), {
      path: { type: 'string' },
      url: { type: 'string' },
      description: { type: 'string', alias: 'd' },
    });

    if (ctx.options.dryRun) {
      ctx.term.info(`[DRY-RUN] 将创建技能: ${name}${flags.path ? ` (from --path ${flags.path})` : flags.url ? ` (from --url ${flags.url})` : ''}`);
      if (ctx.options.json) ctx.term.jsonOut({ action: 'skills.create', name, dryRun: true, source: flags.path ? 'path' : flags.url ? 'url' : 'skeleton' });
      return;
    }

    try {
      await ctx.services.skill.create({
        name,
        description: (flags.description as string) || '',
        content: '',
      });
      ctx.term.ok(`技能 "${name}" 已创建`);
      if (!ctx.options.dryRun) await ctx.audit.append('skills.create', { name, source: flags.path ? 'path' : flags.url ? 'url' : 'skeleton' });
    } catch (e) {
      ctx.term.err((e as Error).message);
    }
    return;
  }

  // ── remove ───────────────────────────────────────────
  if (sub === 'remove' || sub === 'rm') {
    const name = args[1];
    if (!name) { ctx.term.err('用法: skills remove <名称> [--yes]'); return; }
    if (!validateSkillName(name)) { ctx.term.err(`非法技能名: ${name}`); return; }

    if (ctx.options.dryRun) {
      ctx.term.info(`[DRY-RUN] 将删除技能: ${name}`);
      if (ctx.options.json) ctx.term.jsonOut({ action: 'skills.remove', name, dryRun: true });
      return;
    }

    if (!ctx.options.yes) {
      const ok = await ctx.prompt.confirm(`确认删除技能 "${name}"？(y/N) `);
      if (!ok) { ctx.term.raw('已取消'); return; }
    }

    try {
      await ctx.services.skill.delete(name);
      ctx.term.ok(`技能 "${name}" 已删除`);
      if (!ctx.options.dryRun) await ctx.audit.append('skills.remove', { name });
    } catch (e) {
      ctx.term.err((e as Error).message);
    }
    return;
  }

  // ── edit ─────────────────────────────────────────────
  if (sub === 'edit') {
    const name = args[1];
    if (!name) { ctx.term.err('用法: skills edit <名称>'); return; }

    if (ctx.options.dryRun) {
      ctx.term.info(`[DRY-RUN] 将打开编辑器: ${name}`);
      if (ctx.options.json) ctx.term.jsonOut({ action: 'skills.edit', name, dryRun: true });
      return;
    }

    const filePath = `${SKILLS_DIR}/${name}/SKILL.md`;
    const exists = await ctx.fs.exists(filePath);
    if (!exists) { ctx.term.err(`技能 "${name}" 不存在`); return; }

    const editor = process.env.EDITOR || 'vi';
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync(editor, [filePath], { stdio: 'inherit' });
    if (r.status !== 0) ctx.term.err(`编辑器退出码: ${r.status}`);
    return;
  }

  // ── add-path ─────────────────────────────────────────
  if (sub === 'add-path') {
    const name = args[1];
    const newPath = args[2];
    if (!name || !newPath) { ctx.term.err('用法: skills add-path <名称> <路径>'); return; }

    const result = await readSkillFrontmatter(ctx.fs, ctx.term, name);
    if (!result) return;
    const { current, frontmatterStart } = result;

    const paths = [...(current.paths as string[] || []), newPath];
    const newFrontmatter = { ...current, paths };
    await writeSkillFrontmatter(ctx.fs, ctx.term, name, newFrontmatter, frontmatterStart);
    ctx.term.ok(`技能 "${name}" 已添加路径: ${newPath}`);
    if (!ctx.options.dryRun) await ctx.audit.append('skills.add-path', { name, path: newPath });
    return;
  }

  // ── add-url ──────────────────────────────────────────
  if (sub === 'add-url') {
    const name = args[1];
    const url = args[2];
    if (!name || !url) { ctx.term.err('用法: skills add-url <名称> <URL>'); return; }

    const result = await readSkillFrontmatter(ctx.fs, ctx.term, name);
    if (!result) return;
    const { current, frontmatterStart } = result;

    const newFrontmatter = { ...current, url };
    await writeSkillFrontmatter(ctx.fs, ctx.term, name, newFrontmatter, frontmatterStart);
    ctx.term.ok(`技能 "${name}" 已添加 URL: ${url}`);
    if (!ctx.options.dryRun) await ctx.audit.append('skills.add-url', { name, url });
    return;
  }

  ctx.term.err('用法: skills <list|doctor|create|remove|edit|add-path|add-url> [参数]');
};

/** 读取技能 SKILL.md 的 frontmatter，返回当前 frontmatter 及开始行号 */
async function readSkillFrontmatter(
  ctx: CliContext, name: string,
): Promise<{ current: Record<string, unknown>; frontmatterStart: number } | null> {
  const filePath = `${SKILLS_DIR}/${name}/SKILL.md`;
  const raw = await fs.readFile(filePath).catch(() => '');
  if (!raw) { term.err(`技能 "${name}" 不存在`); return null; }
  const parsed = fs.parseMarkdown(raw);
  return { current: parsed.frontmatter, frontmatterStart: raw.indexOf('---', 3) > 0 ? 3 : 0 };
}

/** 写回技能 SKILL.md frontmatter */
async function writeSkillFrontmatter(
  ctx: CliContext, name: string,
  frontmatter: Record<string, unknown>,
  frontmatterStart: number,
): Promise<void> {
  const filePath = `${SKILLS_DIR}/${name}/SKILL.md`;
  const raw = await fs.readFile(filePath);
  const parsed = fs.parseMarkdown(raw);
  const content = ctx.fs.serializeMarkdown(frontmatter, parsed.content);
  await fs.writeFile(filePath, content);
}

// ============================================================
// MCP 管理
// ============================================================
export const mcpHandler: CommandHandler = async (args, ctx) => {
  const sub = args[0];

  if (!sub || sub === 'list' || sub === 'ls') {
    // 委托给 listHandler
    const { listHandler: listFn } = await import('./providers');
    await listFn(['mcp', ...args.slice(1)], ctx);
    return;
  }

  const config = await ctx.configPort.read();
  const mcp = (config.mcp || {}) as unknown as Record<string, Record<string, unknown>>;

  if (sub === 'add') {
    const name = args[1];
    if (!name) { ctx.term.err('用法: mcp add <名称> --command <命令> [参数...]'); return; }
    const { flags } = parseFlags(args.slice(2), {
      command: { type: 'string' },
      url: { type: 'string' },
      header: { type: 'string' },
    });

    if (!flags.command && !flags.url) { ctx.term.err('必须提供 --command 或 --url'); return; }

    if (mcp[name]) { ctx.term.err(`MCP 服务器 "${name}" 已存在`); return; }

    if (ctx.options.dryRun) {
      ctx.term.info(`[DRY-RUN] 将添加 MCP: ${name}`);
      return;
    }

    const entry: Record<string, unknown> = {};
    if (flags.command) {
      entry.type = 'local';
      entry.command = (flags.command as string).split(/\s+/);
    } else {
      entry.type = 'remote';
      entry.url = flags.url as string;
      if (flags.header) {
        const headers: Record<string, string> = {};
        const hdrParts = (flags.header as string).split('=');
        if (hdrParts.length === 2) headers[hdrParts[0]] = hdrParts[1];
        entry.headers = headers;
      }
    }

    mcp[name] = entry;
    await ctx.configPort.write({ ...config, mcp } as never);
    ctx.term.ok(`已添加 MCP 服务器: ${name}`);
    return;
  }

  if (sub === 'remove' || sub === 'rm') {
    const name = args[1];
    if (!name) { ctx.term.err('用法: mcp remove <名称>'); return; }
    if (!mcp[name]) { ctx.term.err(`MCP 服务器 "${name}" 不存在`); return; }
    if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将删除 MCP: ${name}`); return; }
    delete mcp[name];
    await ctx.configPort.write({ ...config, mcp } as never);
    ctx.term.ok(`已删除 MCP 服务器: ${name}`);
    return;
  }

  if (sub === 'toggle') {
    const name = args[1];
    if (!name) { ctx.term.err('用法: mcp toggle <名称>'); return; }
    if (!mcp[name]) { ctx.term.err(`MCP 服务器 "${name}" 不存在`); return; }
    const current = mcp[name].enabled !== false;
    if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将 ${current ? '禁用' : '启用'} MCP: ${name}`); return; }
    mcp[name].enabled = !current;
    await ctx.configPort.write({ ...config, mcp } as never);
    ctx.term.ok(`已${current ? '禁用' : '启用'} MCP: ${name}`);
    return;
  }

  ctx.term.err('用法: mcp <add|remove|toggle|list> [参数]');
};

// ============================================================
// Tool 管理
// ============================================================
export const toolHandler: CommandHandler = async (args, ctx) => {
  const sub = args[0];

  if (!sub || sub === 'list' || sub === 'ls') {
    const { flags } = parseFlags(args.slice(1), { verbose: { type: 'boolean' } });
    ctx.term.raw('工具: (使用默认配置)');
    return;
  }

  if (sub === 'toggle') {
    const toolName = args[1];
    if (!toolName) { ctx.term.err('用法: tool toggle <工具名>'); return; }
    const config = await ctx.configPort.read();
    const tools = (config.tools || {}) as Record<string, boolean>;
    const current = tools[toolName];
    const newVal = current === undefined ? false : !current;
    if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将切换工具 ${toolName}: ${newVal}`); return; }
    tools[toolName] = newVal;
    await ctx.configPort.write({ ...config, tools } as never);
    ctx.term.ok(`工具 ${toolName}: ${newVal ? '启用' : '禁用'}`);
    return;
  }

  if (sub === 'set') {
    const toolName = args[1];
    const rawVal = args[2];
    if (!toolName || rawVal === undefined) { ctx.term.err('用法: tool set <工具名> <true|false>'); return; }
    const val = rawVal === 'true' || rawVal === '1';
    const config = await ctx.configPort.read();
    const tools = (config.tools || {}) as Record<string, boolean>;
    if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将设置工具 ${toolName} = ${val}`); return; }
    tools[toolName] = val;
    await ctx.configPort.write({ ...config, tools } as never);
    ctx.term.ok(`工具 ${toolName}: ${val ? '启用' : '禁用'}`);
    return;
  }

  if (sub === 'reset') {
    if (ctx.options.dryRun) { ctx.term.info('[DRY-RUN] 将重置工具配置'); return; }
    const config = await ctx.configPort.read();
    await ctx.configPort.write({ ...config, tools: {} } as never);
    ctx.term.ok('工具配置已重置');
    return;
  }

  ctx.term.err('用法: tool <list|toggle|set|reset> [参数]');
};

// ============================================================
// Server 配置
// ============================================================
export const serverHandler: CommandHandler = async (args, ctx) => {
  const sub = args[0];
  const { flags } = parseFlags(args.slice(1), {
    port: { type: 'number' },
    hostname: { type: 'string' },
    mdns: { type: 'boolean' },
    cors: { type: 'boolean' },
  });

  if (sub === 'show') {
    const config = await ctx.configPort.read();
    const server = (config.server || {}) as Record<string, unknown>;
    ctx.term.raw(JSON.stringify(server, null, 2));
    return;
  }

  if (sub === 'set') {
    const update: Record<string, unknown> = {};
    if (flags.port !== undefined) update.port = flags.port;
    if (flags.hostname !== undefined) update.hostname = flags.hostname;
    if (flags.mdns !== undefined) update.mdns = flags.mdns;
    if (flags.cors !== undefined) update.cors = flags.cors;
    if (Object.keys(update).length === 0) { ctx.term.err('无可设置的选项'); return; }
    if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将设置 server: ${JSON.stringify(update)}`); return; }
    await ctx.services.config.updateConfig({ server: update } as Record<string, unknown>);
    ctx.term.ok('已更新服务器配置');
    return;
  }

  ctx.term.err('用法: server <show|set> [--port] [--hostname] [--mdns] [--cors]');
};

// ============================================================
// Plugin 管理（完整实现）
// ============================================================
const PLUGINS_DIR = path.join(os.homedir(), '.config', 'opencode', 'plugins');
const GLOBAL_PLUGINS_DIR = path.join(PLUGINS_DIR, 'global');

/** 读取插件的 package.json */
async function readPluginPackage(fs: IFileSystemPort, pluginDir: string): Promise<{ name: string; version: string } | null> {
  try {
    const raw = await fs.readFile(path.join(pluginDir, 'package.json'));
    const pkg = JSON.parse(raw);
    return { name: pkg.name || path.basename(pluginDir), version: pkg.version || '0.0.0' };
  } catch { return null; }
}

export const pluginHandler: CommandHandler = async (args, ctx) => {
  const sub = args[0];

  // ── list ─────────────────────────────────────────────
  if (!sub || sub === 'list') {
    const dirs = [PLUGINS_DIR, GLOBAL_PLUGINS_DIR];
    const plugins: { name: string; version: string; global: boolean }[] = [];

    for (const dir of dirs) {
      try {
        const entries = await ctx.fs.readDir(dir);
        for (const e of entries) {
          if (!e.isDirectory) continue;
          // 跳过 node_modules 自身
          if (e.name === 'node_modules') continue;
          const pluginDir = path.join(dir, e.name);
          // 检查是否有 package.json
          const pkg = await readPluginPackage(ctx.fs, pluginDir);
          if (pkg) {
            plugins.push({ name: pkg.name, version: pkg.version, global: dir === GLOBAL_PLUGINS_DIR });
          }
        }
      } catch { /* dir doesn't exist */ }
    }

    if (plugins.length === 0) { ctx.term.raw('(无插件)'); return; }

    if (ctx.options.json) {
      ctx.term.jsonOut({ action: 'plugin.list', plugins });
      return;
    }

    ctx.term.raw(`插件 (${plugins.length}):`);
    for (const p of plugins) {
      ctx.term.raw(`  ${p.name}@${p.version}${p.global ? ' [global]' : ''}`);
    }
    return;
  }

  // ── install ──────────────────────────────────────────
  if (sub === 'install') {
    const name = args[1];
    if (!name) { ctx.term.err('用法: plugin install <npm包名> [--global] [--force]'); return; }

    const { flags } = parseFlags(args.slice(2), {
      global: { type: 'boolean', alias: 'g' },
      force: { type: 'boolean', alias: 'f' },
    });

    const targetDir = flags.global ? GLOBAL_PLUGINS_DIR : PLUGINS_DIR;
    await ctx.fs.ensureDir(targetDir);

    // 检查是否已存在
    if (!flags.force) {
      const { execSync } = await import('node:child_process');
      try {
        const existing = execSync(`npm ls ${name} --prefix "${targetDir}" --depth=0 --json`, { encoding: 'utf-8' });
        if (JSON.parse(existing).dependencies?.[name]) {
          ctx.term.err(`插件 "${name}" 已存在，使用 --force 覆盖安装`);
          return;
        }
      } catch { /* not installed — proceed */ }
    }

    if (ctx.options.dryRun) {
      ctx.term.info(`[DRY-RUN] 将安装插件: ${name}${flags.global ? ' [--global]' : ''}`);
      if (ctx.options.json) ctx.term.jsonOut({ action: 'plugin.install', name, global: !!flags.global, dryRun: true });
      return;
    }

    try {
      const { execSync } = await import('node:child_process');
      execSync(`npm install ${name} --prefix "${targetDir}" --silent`, { stdio: 'pipe' });
      const pkg = await readPluginPackage(ctx.fs, path.join(targetDir, 'node_modules', name));
      ctx.term.ok(`插件 "${name}" 已安装${flags.global ? ' (global)' : ''}`);
      if (pkg && !ctx.options.dryRun) await ctx.audit.append('plugin.install', { name, version: pkg.version, global: !!flags.global });
    } catch (e) {
      ctx.term.err(`安装失败: ${(e as Error).message}`);
    }
    return;
  }

  // ── remove ───────────────────────────────────────────
  if (sub === 'remove' || sub === 'rm') {
    const name = args[1];
    if (!name) { ctx.term.err('用法: plugin remove <插件名>'); return; }

    // 查找插件目录
    const { execSync } = await import('node:child_process');
    let targetDir: string | null = null;
    for (const dir of [PLUGINS_DIR, GLOBAL_PLUGINS_DIR]) {
      try {
        const p = path.join(dir, 'node_modules', name);
        if (await ctx.fs.exists(p)) { targetDir = p; break; }
      } catch { /* ignore */ }
    }

    if (!targetDir) { ctx.term.err(`插件 "${name}" 未找到`); return; }

    if (ctx.options.dryRun) {
      ctx.term.info(`[DRY-RUN] 将卸载插件: ${name}`);
      if (ctx.options.json) ctx.term.jsonOut({ action: 'plugin.remove', name, dryRun: true });
      return;
    }

    if (!ctx.options.yes) {
      const ok = await ctx.prompt.confirm(`确认卸载插件 "${name}"？(y/N) `);
      if (!ok) { ctx.term.raw('已取消'); return; }
    }

    try {
      await ctx.fs.deleteDir(targetDir);
      ctx.term.ok(`插件 "${name}" 已卸载`);
      if (!ctx.options.dryRun) await ctx.audit.append('plugin.remove', { name });
    } catch (e) {
      ctx.term.err(`卸载失败: ${(e as Error).message}`);
    }
    return;
  }

  ctx.term.err('用法: plugin <list|install|remove> [参数]');
};

// ============================================================
// Reference 管理
// ============================================================
export const referenceHandler: CommandHandler = async (args, ctx) => {
  const sub = args[0];
  const config = await ctx.configPort.read();
  const refs = (config.reference || {}) as unknown as Record<string, Record<string, unknown>>;

  if (!sub || sub === 'list') {
    if (Object.keys(refs).length === 0) { ctx.term.raw('(无引用)'); return; }
    ctx.term.raw(`引用 (${Object.keys(refs).length}):`);
    for (const [name, r] of Object.entries(refs)) {
      ctx.term.raw(`  ${name}: ${r.url || r.path || '(未知)'}`);
    }
    return;
  }

  if (sub === 'add') {
    const name = args[1];
    if (!name) { ctx.term.err('用法: reference add <名称> <路径|URL> [--description] [--branch]'); return; }
    const target = args[2];
    if (!target) { ctx.term.err('用法: reference add <名称> <路径|URL>'); return; }
    const { flags } = parseFlags(args.slice(3), {
      description: { type: 'string' },
      branch: { type: 'string' },
    });

    if (refs[name]) { ctx.term.err(`引用 "${name}" 已存在`); return; }
    if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将添加引用: ${name}`); return; }

    const entry: Record<string, unknown> = {};
    if (target.startsWith('http://') || target.startsWith('https://')) {
      entry.url = target;
      if (flags.branch) entry.branch = flags.branch;
    } else {
      entry.path = target;
    }
    if (flags.description) entry.description = flags.description;

    refs[name] = entry;
    await ctx.configPort.write({ ...config, references: refs } as never);
    ctx.term.ok(`已添加引用: ${name}`);
    return;
  }

  if (sub === 'remove') {
    const name = args[1];
    if (!name) { ctx.term.err('用法: reference remove <名称>'); return; }
    if (!refs[name]) { ctx.term.err(`引用 "${name}" 不存在`); return; }
    if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将删除引用: ${name}`); return; }
    delete refs[name];
    await ctx.configPort.write({ ...config, references: refs } as never);
    ctx.term.ok(`已删除引用: ${name}`);
    return;
  }

  ctx.term.err('用法: reference <add|remove|list> [参数]');
};

// ============================================================
// Command（自定义）
// ============================================================
export const commandCustomHandler: CommandHandler = async (args, ctx) => {
  const sub = args[0];
  const config = await ctx.configPort.read();
  const commands = (config.command || {}) as unknown as Record<string, Record<string, unknown>>;

  if (!sub || sub === 'list') {
    if (Object.keys(commands).length === 0) { ctx.term.raw('(无自定义命令)'); return; }
    ctx.term.raw(`自定义命令 (${Object.keys(commands).length}):`);
    for (const [name] of Object.entries(commands)) ctx.term.raw(`  ${name}`);
    return;
  }

  if (sub === 'add') {
    const name = args[1];
    if (!name) { ctx.term.err('用法: command add <名称> --template <模板>'); return; }
    const { flags } = parseFlags(args.slice(2), {
      template: { type: 'string' },
    });
    if (!flags.template) { ctx.term.err('必须提供 --template'); return; }
    if (commands[name]) { ctx.term.err(`命令 "${name}" 已存在`); return; }
    if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将添加命令: ${name}`); return; }
    commands[name] = { template: flags.template };
    await ctx.configPort.write({ ...config, commands } as never);
    ctx.term.ok(`已添加命令: ${name}`);
    return;
  }

  if (sub === 'remove') {
    const name = args[1];
    if (!name) { ctx.term.err('用法: command remove <名称>'); return; }
    if (!commands[name]) { ctx.term.err(`命令 "${name}" 不存在`); return; }
    if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将删除命令: ${name}`); return; }
    delete commands[name];
    await ctx.configPort.write({ ...config, commands } as never);
    ctx.term.ok(`已删除命令: ${name}`);
    return;
  }

  ctx.term.err('用法: command <add|remove|list> [参数]');
};

// ============================================================
// 高级设置: compaction, tool-output, experimental, attachment
// ============================================================
export const compactionHandler: CommandHandler = async (args, ctx) => {
  const sub = args[0];
  const { flags } = parseFlags(args.slice(1), {
    auto: { type: 'boolean' },
    prune: { type: 'boolean' },
    'tail-turns': { type: 'number' },
    reserved: { type: 'number' },
  });

  if (sub === 'show') {
    const config = await ctx.configPort.read();
    ctx.term.raw(JSON.stringify((config as Record<string, unknown>).compaction || {}, null, 2));
    return;
  }

  if (sub === 'set') {
    const update: Record<string, unknown> = {};
    if (flags.auto !== undefined) update.auto = flags.auto;
    if (flags.prune !== undefined) update.prune = flags.prune;
    if (flags['tail-turns'] !== undefined) update.tailTurns = flags['tail-turns'];
    if (flags.reserved !== undefined) update.reserved = flags.reserved;
    if (Object.keys(update).length === 0) { ctx.term.err('无可设置的选项'); return; }
    if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将设置 compaction: ${JSON.stringify(update)}`); return; }
    const config = await ctx.configPort.read();
    const current = ((config as Record<string, unknown>).compaction || {}) as Record<string, unknown>;
    (config as Record<string, unknown>).compaction = { ...current, ...update };
    await ctx.configPort.write(config);
    ctx.term.ok('已更新压缩配置');
    return;
  }

  ctx.term.err('用法: compaction <show|set> [--auto] [--prune] [--tail-turns N] [--reserved N]');
};

export const toolOutputHandler: CommandHandler = async (args, ctx) => {
  const sub = args[0];
  const { flags } = parseFlags(args.slice(1), {
    'max-lines': { type: 'number' },
    'max-bytes': { type: 'number' },
  });

  if (sub === 'show') {
    const config = await ctx.configPort.read();
    ctx.term.raw(JSON.stringify((config as Record<string, unknown>).toolOutput || {}, null, 2));
    return;
  }

  if (sub === 'set') {
    const update: Record<string, unknown> = {};
    if (flags['max-lines'] !== undefined) update.maxLines = flags['max-lines'];
    if (flags['max-bytes'] !== undefined) update.maxBytes = flags['max-bytes'];
    if (Object.keys(update).length === 0) { ctx.term.err('无可设置的选项'); return; }
    if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将设置 tool-output: ${JSON.stringify(update)}`); return; }
    const config = await ctx.configPort.read();
    const current = ((config as Record<string, unknown>).toolOutput || {}) as Record<string, unknown>;
    (config as Record<string, unknown>).toolOutput = { ...current, ...update };
    await ctx.configPort.write(config);
    ctx.term.ok('已更新工具输出配置');
    return;
  }

  ctx.term.err('用法: tool-output <show|set> [--max-lines N] [--max-bytes N]');
};

export const experimentalHandler: CommandHandler = async (args, ctx) => {
  const sub = args[0];
  if (sub === 'list') {
    const config = await ctx.configPort.read();
    ctx.term.raw(JSON.stringify((config as Record<string, unknown>).experimental || {}, null, 2));
    return;
  }

  if (sub === 'set') {
    const feature = args[1];
    const rawVal = args[2];
    if (!feature || rawVal === undefined) { ctx.term.err('用法: experimental set <特性> <true|false>'); return; }
    const val = rawVal === 'true';
    if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将设置 experimental ${feature} = ${val}`); return; }
    const config = await ctx.configPort.read();
    const current = ((config as Record<string, unknown>).experimental || {}) as Record<string, unknown>;
    (config as Record<string, unknown>).experimental = { ...current, [feature]: val };
    await ctx.configPort.write(config);
    ctx.term.ok(`已${val ? '启用' : '禁用'}实验性功能: ${feature}`);
    return;
  }

  ctx.term.err('用法: experimental <list|set>');
};

export const attachmentHandler: CommandHandler = async (args, ctx) => {
  const sub = args[0];
  const { flags } = parseFlags(args.slice(1), {
    'max-width': { type: 'number' },
    'max-height': { type: 'number' },
    'max-bytes': { type: 'number' },
  });

  if (sub === 'set') {
    const dim = args[1];
    const rawVal = args[2];
    if (dim && rawVal !== undefined) {
      // 支持: attachment set max-width 800
      const update: Record<string, unknown> = {};
      update[dim.replace(/-/g, '')] = parseFloat(rawVal);
      if (ctx.options.dryRun) { ctx.term.info(`[DRY-RUN] 将设置 attachment: ${JSON.stringify(update)}`); return; }
      const config = await ctx.configPort.read();
      const current = ((config as Record<string, unknown>).attachment || {}) as Record<string, unknown>;
      (config as Record<string, unknown>).attachment = { ...current, ...update };
      await ctx.configPort.write(config);
      ctx.term.ok('已更新附件限制');
      return;
    }
    ctx.term.err('用法: attachment set max-width|max-height|max-bytes <数字>');
    return;
  }

  ctx.term.err('用法: attachment set max-width|max-height|max-bytes <数字>');
};

// ============================================================
// UI（占位 — 按旧 CLI 行为保留导出）
// ============================================================
export const uiHandler: CommandHandler = async (_args, ctx) => {
  ctx.term.info('启动 Web 控制台...');
  ctx.term.raw('请在浏览器中访问 https://127.0.0.1:3456');
};

// ============================================================
// Self Update
// ============================================================
export const selfUpdateHandler: CommandHandler = async (_args, ctx) => {
  const pkgName = 'opencode-config-panel';
  const { execSync } = await import('node:child_process');

  // 读取本地版本
  let currentVersion = '0.0.0';
  try {
    const pkgRaw = await ctx.fs.readFile(
      path.join(process.cwd(), 'package.json')
    );
    const pkg = JSON.parse(pkgRaw);
    currentVersion = pkg.version || currentVersion;
  } catch { /* ignore */ }

  if (ctx.options.dryRun) {
    ctx.term.info(`[DRY-RUN] 将检查 ${pkgName} 更新 (当前: ${currentVersion})`);
    if (ctx.options.json) ctx.term.jsonOut({ action: 'self.update', current: currentVersion, dryRun: true });
    return;
  }

  // 查询 npm registry
  let latestVersion = currentVersion;
  try {
    const viewJson = execSync(`npm view ${pkgName} version --json`, { encoding: 'utf-8' }).trim();
    latestVersion = JSON.parse(viewJson);
  } catch { /* ignore network errors */ }

  if (latestVersion === currentVersion) {
    ctx.term.ok(`已是最新版本: ${currentVersion}`);
    if (ctx.options.json) ctx.term.jsonOut({ action: 'self.update', current: currentVersion, latest: latestVersion, updated: false });
    return;
  }

  ctx.term.info(`发现新版本: ${currentVersion} → ${latestVersion}`);
  if (ctx.options.json) ctx.term.jsonOut({ action: 'self.update', current: currentVersion, latest: latestVersion, updated: false });

  // 实际安装
  if (!ctx.options.yes) {
    const ok = await ctx.prompt.confirm(`确认更新到 ${latestVersion}？(y/N) `);
    if (!ok) { ctx.term.raw('已取消'); return; }
  }

  try {
    execSync(`npm install -g ${pkgName}@latest --silent`, { stdio: 'pipe' });
    ctx.term.ok(`已更新到 ${latestVersion}`);
    if (!ctx.options.dryRun) await ctx.audit.append('self.update', { from: currentVersion, to: latestVersion });
    if (ctx.options.json) ctx.term.jsonOut({ action: 'self.update', current: currentVersion, latest: latestVersion, updated: true });
  } catch (e) {
    ctx.term.err(`更新失败: ${(e as Error).message}`);
  }
};
