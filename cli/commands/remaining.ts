/**
 * 剩余命令：log, json, skills, mcp, tool, server, plugin, reference,
 * command-custom, compaction, tool-output, experimental, attachment, ui, self
 */

import path from 'node:path';
import os from 'node:os';
import type { CommandHandler } from '../types';
import { parseFlags, validateEnum } from '../utils';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'opencode');
const AUDIT_LOG_PATH = path.join(CONFIG_DIR, '.audit.log');

// ============================================================
// 审计日志
// ============================================================
export const logHandler: CommandHandler = async (args, ctx) => {
  const sub = args[0];
  if (sub === 'clear') {
    if (ctx.options.dryRun) { ctx.term.info('[DRY-RUN] 将清空审计日志'); return; }
    await ctx.fs.writeFile(AUDIT_LOG_PATH, '[]');
    ctx.term.ok('审计日志已清空');
    return;
  }

  try {
    const raw = await ctx.fs.readFile(AUDIT_LOG_PATH);
    const entries = JSON.parse(raw) as Array<{ time: string; action: string; detail?: Record<string, unknown> }>;
    const tail = parseInt(args[1] || '20', 10);
    const recent = entries.slice(-tail);

    if (ctx.options.json) { ctx.term.jsonOut(recent); return; }

    if (recent.length === 0) { ctx.term.raw('(无审计日志)'); return; }
    ctx.term.raw(`审计日志 (最近 ${recent.length} 条):`);
    for (const e of recent) {
      ctx.term.raw(`  ${e.time}  ${e.action}${e.detail ? ' ' + JSON.stringify(e.detail) : ''}`);
    }
  } catch { ctx.term.raw('(无审计日志)'); }
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
    return;
  }

  ctx.term.err('用法: json <get|set|patch> <路径> [值]');
};

// ============================================================
// Skills 管理
// ============================================================
export const skillsHandler: CommandHandler = async (args, ctx) => {
  const sub = args[0];
  if (!sub || sub === 'list') {
    const { flags } = parseFlags(args.slice(1), { verbose: { type: 'boolean' } });
    const result = await ctx.services.skill.scan();
    if (result.skills.length === 0) { ctx.term.raw('(无技能)'); return; }
    for (const s of result.skills) {
      ctx.term.raw(`  ${s.name}${s.description ? ` — ${s.description}` : ''}`);
    }
    ctx.term.raw(`技能 (${result.skills.length})`);
    return;
  }

  if (sub === 'doctor') {
    const result = await ctx.services.skill.scan();
    ctx.term.ok(`共 ${result.skills.length} 个技能`);
    return;
  }

  ctx.term.err('技能管理功能迁移中，请使用旧版 occ.mjs');
};

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
// Plugin 管理
// ============================================================
export const pluginHandler: CommandHandler = async (args, ctx) => {
  const sub = args[0];
  if (!sub || sub === 'list') {
    ctx.term.raw('(无插件)');
    return;
  }
  ctx.term.err('插件管理功能迁移中');
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
// UI 和 Self Update
// ============================================================
export const uiHandler: CommandHandler = async (_args, ctx) => {
  ctx.term.info('启动 Web 控制台...');
  ctx.term.raw('请在浏览器中访问 https://127.0.0.1:3456');
};

export const selfUpdateHandler: CommandHandler = async (_args, ctx) => {
  ctx.term.info('自更新功能占位');
};
