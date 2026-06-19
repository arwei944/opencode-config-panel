#!/usr/bin/env node

/**
 * occ — Opencode 配置管理 CLI 工具
 * ==============================================
 * 任意智能体可以通过此命令行工具直接读写 opencode 配置。
 * 无需启动 Express 服务器，直接操作配置文件。
 *
 * 用法:
 *   node scripts/occ.mjs <命令> [参数...]
 *
 * 示例:
 *   node scripts/occ.mjs status
 *   node scripts/occ.mjs list providers
 *   node scripts/occ.mjs get model
 *   node scripts/occ.mjs set model opencode/deepseek-v4-flash-free
 *   node scripts/occ.mjs add provider https://api.openai.com/v1 sk-xxx
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

// ============================================================
// 路径常量
// ============================================================
const CONFIG_DIR   = path.join(os.homedir(), '.config', 'opencode');
const CONFIG_PATH  = path.join(CONFIG_DIR, 'opencode.json');
const AUTH_PATH    = path.join(os.homedir(), '.local', 'share', 'opencode', 'auth.json');
const ACCOUNT_PATH = path.join(os.homedir(), '.local', 'share', 'opencode', 'account.json');
const BACKUPS_DIR  = path.join(CONFIG_DIR, 'backups');
const AGENTS_DIR   = path.join(CONFIG_DIR, 'agents');
const SKILLS_DIR   = path.join(CONFIG_DIR, 'skills');

// ============================================================
// 已知的 opencode 模型
// ============================================================
const OPENCODE_MODELS = [
  'big-pickle', 'deepseek-v4-flash-free', 'mimo-v2.5-free',
  'nemotron-3-ultra-free', 'north-mini-code-free',
];

// URL → 提供商类型探测规则
const URL_RULES = [
  { pattern: /openai\.com/i,     type: 'openai',   name: 'openai' },
  { pattern: /anthropic\.com/i,  type: 'anthropic', name: 'anthropic' },
  { pattern: /googleapis\.com/i, type: 'google',    name: 'google' },
  { pattern: /deepseek\.com/i,   type: 'openai',    name: 'deepseek' },
  { pattern: /azure\.com/i,      type: 'openai',    name: 'azure' },
  { pattern: /github\.com/i,     type: 'openai',    name: 'github' },
];

// 账户名 → 提供商名映射
const ACCOUNT_TO_PROVIDER = { 'agnes-ai': 'opencode' };

// ============================================================
// 辅助函数
// ============================================================

// ============================================================
// 全局选项（由 main() 解析后注入）
// ============================================================
export const globalOptions = {
  json: false,    // --json: 输出可机读的 JSON
  yes: false,     // -y / --yes: 跳过确认提示
  dryRun: false,  // --dry-run: 预览但不写入
  quiet: false,   // -q / --quiet: 静默输出
  verbose: false, // -v / --verbose: 详细输出
  color: true,    // --no-color: 关闭彩色
};

/** 输出（受 --quiet 控制） */
function out(...args) {
  if (!globalOptions.quiet) console.log(...args);
}

/** 成功提示（彩色，受 --quiet 控制） */
function ok(msg) {
  if (globalOptions.quiet) return;
  if (globalOptions.color) console.log(`\x1b[32m✓\x1b[0m ${msg}`);
  else console.log(`✓ ${msg}`);
}

/** 信息提示（受 --quiet 控制） */
function info(msg) {
  if (globalOptions.quiet) return;
  if (globalOptions.color) console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`);
  else console.log(`[INFO] ${msg}`);
}

/** 警告提示 */
function warn(msg) {
  if (globalOptions.color) console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`);
  else console.log(`[WARN] ${msg}`);
}

/** 错误提示 */
function err(msg) {
  if (globalOptions.color) console.error(`\x1b[31m✗\x1b[0m ${msg}`);
  else console.error(`✗ ${msg}`);
}

/** 带缩进的 JSON 输出 */
function jsonOut(data) {
  if (globalOptions.json) {
    // JSON 模式：紧凑、单行可机读
    console.log(JSON.stringify(data));
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

/** 读取 JSON 文件 */
async function readJSON(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch { return null; }
}

/** 写入 JSON 文件（自动创建目录，支持 --dry-run） */
async function writeJSON(filePath, data) {
  if (globalOptions.dryRun) {
    info(`[DRY-RUN] 将写入: ${filePath}`);
    return;
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/** 检查文件是否存在 */
async function fileExists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

/** 校验资源名（template / profile / key / agent 等共享） */
function validateName(name) {
  if (!name || typeof name !== 'string') return '名称不能为空';
  if (name === '.' || name === '..') return '不能使用 . 或 ..';
  if (name.length > 64) return '名称过长（最长 64 字符）';
  if (/[\/\\\0\n\r]/.test(name)) return '名称不能包含 / \\ 0 换行';
  if (!/^[A-Za-z0-9._\-@]+$/.test(name)) return '名称仅允许字母数字 . _ - @';
  return null; // null 表示合法
}

/** dry-run 预览输出（双轨：人类可读 / --json 结构化） */
function dryRunPreview(humanLines, jsonPayload) {
  if (globalOptions.json) {
    jsonOut(jsonPayload);
  } else {
    for (const line of humanLines) info(line);
  }
}

/** 输出对象的顶层 key（用于 dry-run 预览） */
function topKeys(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  return Object.keys(obj);
}

/** 估算 JSON 序列化字节数 */
function jsonByteSize(obj) {
  try { return Buffer.byteLength(JSON.stringify(obj), 'utf-8'); } catch { return 0; }
}

/** 提示用户确认（受 --yes 控制） */
async function confirmPrompt(query) {
  if (globalOptions.yes) return true;
  return new Promise((resolve) => {
    process.stdout.write(query);
    process.stdin.once('data', (data) => {
      const ans = data.toString().trim();
      resolve(ans === 'y' || ans === 'Y' || ans === 'yes');
    });
  });
}

/** 读取一行用户输入（用于交互式选择） */
function readLine(query) {
  return new Promise((resolve) => {
    process.stdout.write(query);
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });
}

/** 用户文本输入 */
async function promptInput(query) {
  return await readLine(query);
}

/** 读取 opencode.json */
async function readConfig() {
  return (await readJSON(CONFIG_PATH)) || {};
}

/** 写入 opencode.json（先备份） */
async function writeConfig(config) {
  try { await backupConfig(); } catch { /* 首次写入可能无文件可备份 */ }
  await writeJSON(CONFIG_PATH, config);
}

/** 创建备份 */
async function backupConfig() {
  try {
    await fs.mkdir(BACKUPS_DIR, { recursive: true });
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const bp = path.join(BACKUPS_DIR, `opencode-${ts}.json`);
    await fs.writeFile(bp, raw, 'utf-8');
    return path.basename(bp);
  } catch (e) {
    if (e.code === 'ENOENT') return null; // 文件还不存在
    throw e;
  }
}

/** 列表 */
function formatList(items) {
  for (const item of items) console.log(`  ${item}`);
}

/**
 * 解析命名参数
 * @param {string[]} args - 原始参数数组
 * @param {object} defs - 参数定义 { name: { type: 'string'|'boolean'|'number', default: val, alias: 'x' } }
 * @returns {{ positional: string[], flags: object, provided: Set<string> }}
 */
function parseFlags(args, defs) {
  const positional = [];
  const flags = {};
  const provided = new Set();
  // 初始化默认值
  for (const [key, d] of Object.entries(defs)) {
    if (d.default !== undefined) {
      flags[key] = d.default;
    } else if (d.type === 'boolean') {
      flags[key] = false;
    } else {
      flags[key] = undefined; // string/number 默认 undefined 以区分"未提供"
    }
  }
  // 建立别名映射
  const aliasMap = {};
  for (const [key, d] of Object.entries(defs)) {
    if (d.alias) aliasMap[d.alias] = key;
  }

  /** 标记 flag 已提供 */
  function markProvided(k) {
    provided.add(k);
    // 如果 k 是别名，也标记原始名
    for (const [orig, alias] of Object.entries(aliasMap)) {
      if (alias === k) provided.add(orig);
    }
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        // --key=value 形式
        const k = arg.slice(2, eqIdx);
        const v = arg.slice(eqIdx + 1);
        markProvided(k);
        if (defs[k]) {
          if (defs[k].type === 'number') {
            flags[k] = Number(v);
          } else if (defs[k].type === 'boolean') {
            flags[k] = v === 'true' || v === '1';
          } else {
            flags[k] = v;
          }
        } else {
          flags[k] = v;
        }
      } else {
        const k = arg.slice(2);
        markProvided(k);
        if (defs[k] && defs[k].type === 'boolean') {
          // 布尔 flag：检查下一个参数是否是 true/false
          const nextVal = args[i + 1];
          if (nextVal === 'true' || nextVal === 'false' || nextVal === '1' || nextVal === '0') {
            flags[k] = nextVal === 'true' || nextVal === '1';
            i++; // 消费下一个参数
          } else {
            flags[k] = true; // 无参数 → true
          }
        } else if (defs[k]) {
          const rawVal = args[++i] || '';
          flags[k] = defs[k].type === 'number' ? Number(rawVal) : rawVal;
        } else {
          // 未知 flag，当作值
          flags[k] = args[++i] || '';
        }
      }
    } else if (arg.startsWith('-') && !arg.startsWith('--')) {
      // 短选项 -x value
      const shortFlag = arg.slice(1);
      const key = aliasMap[shortFlag];
      if (key && defs[key]) {
        markProvided(key);
        if (defs[key].type === 'boolean') {
          flags[key] = true;
        } else {
          const rawVal = args[++i] || '';
          flags[key] = defs[key].type === 'number' ? Number(rawVal) : rawVal;
        }
      } else {
        positional.push(arg);
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags, provided };
}

/** 字符串转布尔值 */
function toBool(val) {
  if (typeof val === 'boolean') return val;
  return val === 'true' || val === '1' || val === 'yes';
}

/** 验证枚举值 */
function validateEnum(val, allowed, name) {
  if (!allowed.includes(val)) {
    console.log(`错误: ${name} 必须是 ${allowed.join('|')}，收到 "${val}"`);
    process.exit(1);
  }
}

// ============================================================
// 命令实现
// ============================================================

// ---- get: 获取配置值 ----
async function cmdGet(args) {
  if (args.length === 0) { console.log('用法: get <键>'); return; }
  const key = args[0];
  const config = await readConfig();

  // 支持点号路径: model, agent.chinese-build.mode
  const keys = key.split('.');
  let val = config;
  for (const k of keys) {
    if (val == null || typeof val !== 'object') { console.log('null'); return; }
    val = val[k];
  }
  if (val === undefined) { console.log('null'); return; }
  if (typeof val === 'object') jsonOut(val);
  else console.log(String(val));
}

// ---- set: 设置配置值 ----
const VALID_LOG_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
const VALID_AUTOUPDATE = ['true', 'false', 'notify'];
const VALID_SHARE = ['manual', 'auto', 'disabled'];

/** set 命令的专用 key 验证器 */
function validateSetKey(key, rawValue, parsedValue) {
  const validators = {
    logLevel:     (v) => { validateEnum(v, VALID_LOG_LEVELS, 'logLevel'); return v; },
    autoupdate:   (v) => {
      const s = String(v);
      if (!VALID_AUTOUPDATE.includes(s)) {
        console.log(`错误: autoupdate 必须是 true|false|notify，收到 "${s}"`);
        process.exit(1);
      }
      return s === 'true' ? true : s === 'false' ? false : s;
    },
    snapshot:     (v) => toBool(v),
    share:        (v) => { validateEnum(v, VALID_SHARE, 'share'); return v; },
  };
  const lastKey = key.split('.').pop();
  if (validators[lastKey]) {
    return validators[lastKey](parsedValue !== undefined ? parsedValue : rawValue);
  }
  return parsedValue !== undefined ? parsedValue : rawValue;
}

async function cmdSet(args) {
  if (args.length < 2) { console.log('用法: set <键> <值>'); return; }
  const key = args[0];
  const value = args.slice(1).join(' ');

  const config = await readConfig();
  const keys = key.split('.');
  let obj = config;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!obj[keys[i]] || typeof obj[keys[i]] !== 'object') obj[keys[i]] = {};
    obj = obj[keys[i]];
  }

  // 解析 JSON 值
  let parsed;
  try { parsed = JSON.parse(value); } catch { parsed = undefined; }

  const finalValue = validateSetKey(key, value, parsed);
  obj[keys[keys.length - 1]] = finalValue;

  await writeConfig(config);
  await appendAuditLog('config.set', { key, value: finalValue });
  console.log(`✓ ${key} = ${String(finalValue)}`);
}

// ---- toggle: 通用布尔值开关 ----
async function cmdToggle(args) {
  if (args.length === 0) { console.log('用法: toggle <键>'); return; }
  const key = args[0];

  const config = await readConfig();
  const keys = key.split('.');
  let obj = config;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!obj[keys[i]] || typeof obj[keys[i]] !== 'object') {
      console.log(`错误: 路径 "${key}" 不存在`);
      return;
    }
    obj = obj[keys[i]];
  }

  const current = obj[keys[keys.length - 1]];
  if (typeof current !== 'boolean' && current !== undefined) {
    console.log(`错误: "${key}" 不是布尔值（当前值: ${current}），无法切换`);
    return;
  }

  obj[keys[keys.length - 1]] = current === false ? true : false;
  await writeConfig(config);
  await appendAuditLog('config.toggle', { key, value: obj[keys[keys.length - 1]] });
  console.log(`✓ ${key} → ${obj[keys[keys.length - 1]] ? '启用' : '禁用'}`);
}

// ---- disabled-providers / enabled-providers 管理 ----
async function cmdDisabledProviders(args) {
  const sub = args[0];
  const config = await readConfig();
  if (!config.disabled_providers) config.disabled_providers = [];

  if (!sub || sub === 'list') {
    if (config.disabled_providers.length === 0) { console.log('(无禁用的提供商)'); return; }
    console.log(`禁用的提供商 (${config.disabled_providers.length}):`);
    for (const p of config.disabled_providers) console.log(`  ${p}`);
    return;
  }

  if (sub === 'add') {
    const name = args[1];
    if (!name) { console.log('用法: disabled-providers add <提供商名>'); return; }
    if (!config.disabled_providers.includes(name)) {
      config.disabled_providers.push(name);
      await writeConfig(config);
      await appendAuditLog('disabledProviders.add', { name });
      console.log(`✓ 提供商 "${name}" 已加入禁用列表`);
    } else {
      console.log(`提供商 "${name}" 已在禁用列表中`);
    }
  } else if (sub === 'remove' || sub === 'rm') {
    const name = args[1];
    if (!name) { console.log('用法: disabled-providers remove <提供商名>'); return; }
    const idx = config.disabled_providers.indexOf(name);
    if (idx === -1) { console.log(`提供商 "${name}" 不在禁用列表中`); return; }
    config.disabled_providers.splice(idx, 1);
    await writeConfig(config);
    await appendAuditLog('disabledProviders.remove', { name });
    console.log(`✓ 提供商 "${name}" 已从禁用列表移除`);
  } else {
    console.log('用法: disabled-providers <add|remove|list> [参数]');
  }
}

async function cmdEnabledProviders(args) {
  const sub = args[0];
  const config = await readConfig();

  if (!sub || sub === 'list') {
    if (!config.enabled_providers || config.enabled_providers.length === 0) {
      console.log('(未设置限制，所有提供商可用)');
      return;
    }
    console.log(`仅限的提供商 (${config.enabled_providers.length}):`);
    for (const p of config.enabled_providers) console.log(`  ${p}`);
    return;
  }

  if (sub === 'set') {
    const names = args.slice(1);
    if (names.length === 0) { console.log('用法: enabled-providers set <提供商名> [<提供商名2> ...]'); return; }
    config.enabled_providers = names;
    await writeConfig(config);
    await appendAuditLog('enabledProviders.set', { providers: names });
    console.log(`✓ 已设置仅限提供商: ${names.join(', ')}`);
  } else if (sub === 'clear') {
    delete config.enabled_providers;
    await writeConfig(config);
    await appendAuditLog('enabledProviders.clear', {});
    console.log('✓ 已清除提供商限制，所有提供商可用');
  } else {
    console.log('用法: enabled-providers <set|clear|list> [参数]');
  }
}

// ---- list: 列出各种资源 ----
async function cmdList(args) {
  const type = args[0];
  if (!type) { console.log('用法: list <providers|models|agents|tools|skills|mcp|backups>'); return; }

  switch (type) {
    case 'providers':
    case 'provider': {
      const config = await readConfig();
      const jsonProviders = config.provider || {};

      // 从 auth.json 读取
      const auth = await readJSON(AUTH_PATH);
      const authAccounts = auth || {};

      // 合并去重
      const merged = { ...jsonProviders };
      for (const [acct, cred] of Object.entries(authAccounts)) {
        const pName = ACCOUNT_TO_PROVIDER[acct] || acct;
        if (!merged[pName]) {
          merged[pName] = { type: cred.type || 'api', _account: acct };
        }
      }

      console.log(`提供商 (${Object.keys(merged).length}):`);
      for (const [name, p] of Object.entries(merged)) {
        const acct = p._account ? ` [账户: ${p._account}]` : '';
        const mc = p.models ? Object.keys(p.models).length : (name === 'opencode' ? OPENCODE_MODELS.length : 0);
        console.log(`  ${name}  type=${p.type}  models=${mc}${acct}`);
      }
      break;
    }

    case 'models':
    case 'model': {
      const config = await readConfig();
      const targetProvider = args[1];

      // 判断是否有 opencode 提供商（在 config.provider 或 auth.json 中）
      const auth = await readJSON(AUTH_PATH);
      const hasOpencode = !!(config.provider?.opencode || auth?.['agnes-ai']);

      if (targetProvider === 'opencode' || (!targetProvider && hasOpencode)) {
        console.log(`opencode 模型 (${OPENCODE_MODELS.length}):`);
        for (const m of OPENCODE_MODELS) console.log(`  opencode/${m}`);
      } else if (config.provider) {
        for (const [name, p] of Object.entries(config.provider)) {
          if (targetProvider && name !== targetProvider) continue;
          if (p.models) {
            console.log(`${name} 模型 (${Object.keys(p.models).length}):`);
            for (const [mk, mv] of Object.entries(p.models)) {
              console.log(`  ${mk}${mv.name ? `  (${mv.name})` : ''}`);
            }
          }
        }
      } else {
        console.log(`opencode 模型 (${OPENCODE_MODELS.length}):`);
        for (const m of OPENCODE_MODELS) console.log(`  opencode/${m}`);
      }
      break;
    }

    case 'agents':
    case 'agent': {
      const config = await readConfig();
      const agents = config.agent || {};

      // 解析参数: --verbose, --filter <mode>
      const { flags: listFlags } = parseFlags(args.slice(1), {
        verbose: { type: 'boolean', alias: 'v' },
        filter:  { type: 'string' },
      });
      const verbose = listFlags.verbose;
      const filterMode = listFlags.filter;

      // 扫描 agents/ 目录
      let dirAgents = [];
      try {
        dirAgents = (await fs.readdir(AGENTS_DIR)).filter(f => f.endsWith('.md')).map(f => f.slice(0, -3));
      } catch {}

      const allNames = new Set([...Object.keys(agents), ...dirAgents]);

      // 过滤
      let entries = [...allNames];
      if (filterMode) {
        entries = entries.filter(name => {
          const a = agents[name];
          return a?.mode === filterMode || (!a && filterMode === 'file-only');
        });
      }

      console.log(`代理 (${entries.length}):`);
      for (const name of entries) {
        const a = agents[name];
        if (!a && verbose) {
          console.log(`  ${name}  [仅文件]`);
          continue;
        }
        if (!a) {
          console.log(`  ${name}  [仅文件]`);
          continue;
        }
        const mode = a.mode || 'subagent';
        const modelStr = a.model ? `  model=${a.model}` : '';
        const permStr = a.permission && Object.keys(a.permission).length > 0
          ? `  permissions=${Object.entries(a.permission).map(([k,v]) => `${k}:${v}`).join(',')}`
          : '';
        const colorStr = a.color ? `  color=${a.color}` : '';
        const stepsStr = a.steps ? `  steps=${a.steps}` : '';
        const hiddenStr = a.hidden ? '  hidden' : '';

        if (verbose) {
          console.log(`  ${name}  (${mode})${modelStr}${permStr}${colorStr}${stepsStr}${hiddenStr}`);
        } else {
          console.log(`  ${name}  (${mode})`);
        }
      }
      break;
    }

    case 'tools':
    case 'tool': {
      const config = await readConfig();
      const tools = config.tools || {};
      if (Object.keys(tools).length === 0) {
        console.log('工具: (使用默认配置)');
      } else {
        console.log(`工具 (${Object.keys(tools).length}):`);
        for (const [name, enabled] of Object.entries(tools)) {
          console.log(`  ${name}  ${enabled ? '✓' : '✗'}`);
        }
      }
      break;
    }

    case 'skills':
    case 'skill': {
      let count = 0;
      try {
        const dirs = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
        for (const d of dirs) {
          if (d.isDirectory()) {
            try {
              await fs.access(path.join(SKILLS_DIR, d.name, 'SKILL.md'));
              const skillPath = path.join(SKILLS_DIR, d.name, 'SKILL.md');
              const content = await fs.readFile(skillPath, 'utf-8');
              // 从 frontmatter 提取 name/description
              const nameMatch = content.match(/^name:\s*(.+)$/m);
              const descMatch = content.match(/^description:\s*(.+)$/m);
              const sName = nameMatch ? nameMatch[1].trim() : d.name;
              const desc = descMatch ? descMatch[1].trim() : '';
              console.log(`  ${sName}${desc ? ` — ${desc}` : ''}`);
              count++;
            } catch { /* 无 SKILL.md */ }
          }
        }
      } catch { /* 目录不存在 */ }
      if (count === 0) console.log('(无技能)');
      else console.log(`技能 (${count})`);
      break;
    }

    case 'mcp': {
      const config = await readConfig();
      const mcp = config.mcp || {};
      const { flags: mcpFlags } = parseFlags(args.slice(1), {
        verbose: { type: 'boolean', alias: 'v' },
      });
      const mcpVerbose = mcpFlags.verbose;

      if (Object.keys(mcp).length === 0) { console.log('(无 MCP 服务器)'); return; }
      console.log(`MCP 服务器 (${Object.keys(mcp).length}):`);
      for (const [name, s] of Object.entries(mcp)) {
        const type = s.type || 'local';
        const enabled = s.enabled !== false ? '启用' : '禁用';
        const cmd = s.command ? (Array.isArray(s.command) ? s.command.join(' ') : s.command) : s.url || '';

        if (mcpVerbose) {
          console.log(`  ${name}`);
          console.log(`    type: ${type}`);
          console.log(`    status: ${enabled}`);
          console.log(`    ${type === 'remote' ? 'url' : 'command'}: ${cmd}`);
          if (s.cwd) console.log(`    cwd: ${s.cwd}`);
          if (s.timeout) console.log(`    timeout: ${s.timeout}ms`);
          if (s.environment && Object.keys(s.environment).length > 0) {
            console.log(`    env: ${Object.keys(s.environment).join(', ')}`);
          }
          if (s.headers && Object.keys(s.headers).length > 0) {
            console.log(`    headers: ${Object.keys(s.headers).join(', ')}`);
          }
        } else {
          console.log(`  ${name}  [${type}]  ${enabled}  ${cmd}`);
        }
      }
      break;
    }

    case 'backups':
    case 'backup': {
      try {
        const files = await fs.readdir(BACKUPS_DIR);
        if (files.length === 0) { console.log('(无备份)'); return; }
        console.log(`备份 (${files.length}):`);
        for (const f of files.sort().reverse()) {
          const stat = await fs.stat(path.join(BACKUPS_DIR, f));
          console.log(`  ${f}  (${(stat.size / 1024).toFixed(1)} KB, ${stat.mtime.toLocaleString()})`);
        }
      } catch { console.log('(无备份)'); }
      break;
    }

    case 'references':
    case 'reference':
    case 'ref':
      await cmdReferenceList(args.slice(1));
      break;

    case 'commands':
    case 'command':
      await cmdCommandList(args.slice(1));
      break;

    default:
      console.log(`未知类型: ${type}`);
      console.log('可用类型: providers, models, agents, tools, skills, mcp, backups, commands');
  }
}

// ---- add: 智能添加提供商 ----
async function cmdAdd(args) {
  if (args.length < 1) { console.log('用法: add provider <url> [apiKey]'); return; }
  const subCmd = args[0];

  if (subCmd === 'provider') {
    const url = args[1];
    const apiKey = args[2] || '';
    if (!url) { console.log('用法: add provider <url> [apiKey]'); return; }

    console.log(`正在探测: ${url} ...`);

    // 1. 从 URL 识别提供商类型
    let providerType = 'openai';
    let providerName = 'custom';
    for (const rule of URL_RULES) {
      if (rule.pattern.test(url)) {
        providerType = rule.type;
        providerName = rule.name;
        break;
      }
    }
    if (providerName === 'custom') {
      try {
        const hostname = new URL(url).hostname;
        providerName = hostname.replace(/^www\./, '').split('.')[0].toLowerCase().replace(/[^a-z0-9-]/g, '');
      } catch {}
    }

    // 2. 尝试拉取模型
    const models = {};
    try {
      const response = await fetch(`${url.replace(/\/+$/, '')}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) {
        const data = await response.json();
        const modelList = data.data || data || [];
        if (Array.isArray(modelList)) {
          for (const m of modelList) {
            if (m.id || m.name || typeof m === 'string') {
              const id = m.id || m;
              models[id] = { id, name: m.name || id };
            }
          }
        }
      }
    } catch {
      console.log('  无法连接 API 获取模型列表，将使用空模型配置');
    }

    // 3. 写入配置
    const config = await readConfig();
    if (!config.provider) config.provider = {};

    if (config.provider[providerName]) {
      console.log(`  提供商 "${providerName}" 已存在，合并更新`);
    }

    config.provider[providerName] = {
      type: providerType,
      options: { baseURL: url, ...(apiKey ? { apiKey } : {}) },
      models,
    };

    // 同时设置 model
    const modelKeys = Object.keys(models);
    if (modelKeys.length > 0) {
      const defaultModel = modelKeys[0];
      config.model = `${providerName}/${defaultModel}`;
      console.log(`  自动设置 model=${config.model}`);
    }

    await writeConfig(config);
    await appendAuditLog('provider.add', { name: providerName, baseURL: url });
    console.log(`✓ 提供商 ${providerName} 已添加 (type=${providerType}, ${modelKeys.length} 个模型)`);

  } else {
    console.log(`未知子命令: ${subCmd}`);
    console.log('用法: add provider <url> [apiKey]');
  }
}

// ---- remove: 删除提供商 ----
async function cmdRemove(args) {
  if (args.length < 2 || args[0] !== 'provider') {
    console.log('用法: remove provider <名称>');
    return;
  }
  const name = args[1];
  const config = await readConfig();
  if (!config.provider || !config.provider[name]) {
    console.log(`提供商 "${name}" 不存在`);
    return;
  }
  delete config.provider[name];

  // 如果 model/small_model 引用了此提供商，清除
  if (config.model && config.model.startsWith(`${name}/`)) config.model = '';
  if (config.small_model && config.small_model.startsWith(`${name}/`)) config.small_model = '';

  if (globalOptions.dryRun) {
    info(`[DRY-RUN] 将删除提供商: ${name}`);
    info(`[DRY-RUN] 将写入: ${CONFIG_PATH}`);
    return;
  }

  await writeConfig(config);
  await appendAuditLog('provider.remove', { name });
  console.log(`✓ 提供商 ${name} 已删除`);
}

// ---- status: 配置概览 ----
async function cmdStatus() {
  const config = await readConfig();

  // 提供商
  const jsonProviders = Object.keys(config.provider || {}).length;
  let authProviders = 0;
  try {
    const auth = await readJSON(AUTH_PATH);
    authProviders = auth ? Object.keys(auth).length : 0;
  } catch {}
  const totalProviders = jsonProviders + authProviders;

  // 模型
  let modelCount = 0;
  if (config.provider) {
    for (const p of Object.values(config.provider)) {
      if (p.models) modelCount += Object.keys(p.models).length;
    }
  }
  // 已知模型
  const hasOpencode = config.provider?.opencode || await readJSON(AUTH_PATH).then(a => a?.['agnes-ai'] ? true : false).catch(() => false);
  if (hasOpencode && (!config.provider?.opencode?.models)) modelCount += OPENCODE_MODELS.length;

  // 代理
  let agentDirCount = 0;
  try { agentDirCount = (await fs.readdir(AGENTS_DIR)).filter(f => f.endsWith('.md')).length; } catch {}
  const agentCount = Math.max(Object.keys(config.agent || {}).length, agentDirCount);

  // 技能
  let skillCount = 0;
  try {
    const dirs = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
    for (const d of dirs) {
      if (d.isDirectory()) {
        try { await fs.access(path.join(SKILLS_DIR, d.name, 'SKILL.md')); skillCount++; } catch {}
      }
    }
  } catch {}

  // MCP
  const mcpCount = Object.keys(config.mcp || {}).length;

  // 工具
  const toolCount = Object.keys(config.tools || {}).length;

  // 文件大小
  let fileSize = 0;
  try { fileSize = (await fs.stat(CONFIG_PATH)).size; } catch {}

  console.log('========================================');
  console.log('  Opencode 配置概览');
  console.log('========================================');
  console.log(`  配置文件: ${CONFIG_PATH}`);
  console.log(`  配置文件大小: ${(fileSize / 1024).toFixed(1)} KB`);
  console.log(`  提供商: ${totalProviders}`);
  console.log(`  模型: ${modelCount}`);
  console.log(`  代理: ${agentCount}`);
  console.log(`  技能: ${skillCount}`);
  console.log(`  MCP 服务器: ${mcpCount}`);
  console.log(`  工具: ${toolCount}`);
  console.log('----------------------------------------');
  console.log(`  model:        ${config.model || '(未设置)'}`);
  console.log(`  small_model:  ${config.small_model || '(未设置)'}`);
  console.log(`  default_agent: ${config.default_agent || '(未设置)'}`);
  console.log('----------------------------------------');
  console.log(`  提供商列表:`);
  if (config.provider) {
    for (const name of Object.keys(config.provider)) {
      console.log(`    - ${name}`);
    }
  }
  try {
    const auth = await readJSON(AUTH_PATH);
    if (auth) {
      for (const acct of Object.keys(auth)) {
        const pName = ACCOUNT_TO_PROVIDER[acct] || acct;
        if (!config.provider || !config.provider[pName]) {
          console.log(`    - ${pName} [凭证账户: ${acct}]`);
        }
      }
    }
  } catch {}
  console.log('========================================');
}

// ---- export: 导出配置 ----
function redactConfig(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redactConfig);
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'apiKey' || k === 'api_key' || k === 'token' || k === 'password' || k === 'secret') {
      const s = String(v || '');
      result[k] = s.length > 8 ? `${s.slice(0, 4)}***${s.slice(-4)}` : '***';
    } else {
      result[k] = redactConfig(v);
    }
  }
  return result;
}

async function cmdExport(args) {
  const { flags, provided } = parseFlags(args, {
    redact: { type: 'boolean', alias: 'r' },
  });
  let config = await readConfig();
  const filePath = flags._ ? flags._[0] : args[0];
  if (provided.has('redact')) {
    config = redactConfig(config);
    info('已脱敏 API Key 等敏感字段');
  }
  if (filePath) {
    await writeJSON(filePath, config);
    await appendAuditLog('config.export', { filePath, redacted: provided.has('redact') });
    ok(`配置已导出到 ${filePath}`);
  } else {
    jsonOut(config);
  }
}

// ---- import: 导入配置 ----
async function cmdImport(args) {
  if (args.length === 0) { console.log('用法: import <文件路径> [--validate-only]'); return; }
  const { flags, provided } = parseFlags(args, {
    'validate-only': { type: 'boolean' },
  });
  const filePath = flags._ ? flags._[0] : args.find(a => !a.startsWith('-'));
  try {
    const data = await readJSON(filePath);
    if (!data) { console.log('文件无效'); return; }
    if (provided.has('validate-only')) {
      if (globalOptions.json) jsonOut({ valid: true, filePath });
      else ok(`配置文件有效: ${filePath}`);
      return;
    }
    await writeConfig(data);
    await appendAuditLog('config.import', { filePath });
    console.log(`✓ 配置已从 ${filePath} 导入`);
  } catch (e) {
    console.log(`导入失败: ${e.message}`);
  }
}

// ---- validate: 验证配置 ----
async function cmdValidate() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    JSON.parse(raw);
    console.log(`✓ 配置语法正确 (${(raw.length / 1024).toFixed(1)} KB)`);
  } catch (e) {
    console.log(`✗ 配置无效: ${e.message}`);
  }
}

// ---- backup: 备份管理 ----
async function cmdBackup(args) {
  const sub = args[0];
  if (!sub || sub === 'create') {
    const name = await backupConfig();
    if (name) ok(`备份已创建: ${name}`);
    else err('备份失败');
    await appendAuditLog('backup.create', { name });
  } else if (sub === 'list') {
    try {
      const files = await fs.readdir(BACKUPS_DIR);
      if (files.length === 0) { console.log('(无备份)'); return; }
      console.log(`备份 (${files.length}):`);
      for (const f of files.sort().reverse()) {
        const stat = await fs.stat(path.join(BACKUPS_DIR, f));
        console.log(`  ${f}  (${(stat.size / 1024).toFixed(1)} KB, ${stat.mtime.toLocaleString()})`);
      }
    } catch { console.log('(无备份)'); }
  } else if (sub === 'restore') {
    const id = args[1];
    if (!id) { console.log('用法: backup restore <备份文件名>'); return; }
    try {
      const data = await readJSON(path.join(BACKUPS_DIR, id));
      if (!data) { console.log('备份文件无效'); return; }
      await writeConfig(data);
      ok(`已从 ${id} 恢复`);
      await appendAuditLog('backup.restore', { id });
    } catch (e) { err(`恢复失败: ${e.message}`); }
  } else if (sub === 'delete') {
    const id = args[1];
    if (!id) { console.log('用法: backup delete <备份文件名>'); return; }
    try {
      if (globalOptions.dryRun) { info(`[DRY-RUN] 将删除: ${id}`); return; }
      await fs.unlink(path.join(BACKUPS_DIR, id));
      ok(`备份 ${id} 已删除`);
      await appendAuditLog('backup.delete', { id });
    } catch (e) { err(`删除失败: ${e.message}`); }
  } else if (sub === 'cleanup') {
    // backup cleanup --keep 20 | --keep 5d
    const { flags, provided } = parseFlags(args.slice(1), {
      keep: { type: 'string' },
    });
    if (!provided.has('keep')) {
      console.log('用法: backup cleanup --keep <N|时间，如 20 或 5d>');
      return;
    }
    const keepSpec = flags.keep;
    let keepCount = null;
    let keepMs = null;
    if (/^\d+$/.test(keepSpec)) keepCount = parseInt(keepSpec, 10);
    else {
      const m = keepSpec.match(/^(\d+)([dh])$/);
      if (!m) { err('--keep 格式错误，应为数字或 5d/12h'); return; }
      const n = parseInt(m[1], 10);
      keepMs = n * (m[2] === 'd' ? 86400000 : 3600000);
    }
    let files = [];
    try { files = await fs.readdir(BACKUPS_DIR); } catch {}
    const stats = [];
    for (const f of files) {
      const s = await fs.stat(path.join(BACKUPS_DIR, f));
      stats.push({ name: f, mtime: s.mtime });
    }
    stats.sort((a, b) => b.mtime - a.mtime);
    const toKeep = new Set();
    if (keepCount !== null) {
      stats.slice(0, keepCount).forEach(s => toKeep.add(s.name));
    } else {
      const now = Date.now();
      for (const s of stats) if (now - s.mtime.getTime() < keepMs) toKeep.add(s.name);
    }
    const toDelete = stats.filter(s => !toKeep.has(s.name));
    if (toDelete.length === 0) { ok('无需清理'); return; }
    if (!globalOptions.yes) {
      const okFlag = await confirmPrompt(`将删除 ${toDelete.length} 个旧备份，确认？(y/N) `);
      if (!okFlag) { console.log('已取消'); return; }
    }
    let deleted = 0;
    for (const s of toDelete) {
      if (globalOptions.dryRun) info(`[DRY-RUN] 将删除: ${s.name}`);
      else await fs.unlink(path.join(BACKUPS_DIR, s.name));
      deleted++;
    }
    ok(`已清理 ${deleted} 个备份`);
  } else if (sub === 'diff') {
    // backup diff <a> <b>
    const a = args[1], b = args[2];
    if (!a || !b) { console.log('用法: backup diff <备份a> <备份b>'); return; }
    const da = await readJSON(path.join(BACKUPS_DIR, a));
    const db = await readJSON(path.join(BACKUPS_DIR, b));
    if (!da || !db) { err('无法读取备份'); return; }
    const changes = diffObject(da, db);
    if (changes.length === 0) { ok('无差异'); return; }
    console.log(`差异 (${a} → ${b}): ${changes.length} 项`);
    for (const c of changes.slice(0, 50)) {
      if (c.op === 'add') console.log(`  + ${c.path} = ${JSON.stringify(c.new)}`);
      else if (c.op === 'remove') console.log(`  - ${c.path} = ${JSON.stringify(c.old)}`);
      else console.log(`  ~ ${c.path}: ${JSON.stringify(c.old)} → ${JSON.stringify(c.new)}`);
    }
    if (changes.length > 50) console.log(`  ... 还有 ${changes.length - 50} 项`);
  } else if (sub === 'watch') {
    // backup watch --interval 10m --keep 20 [--once] [--dry-run]
    const { flags, provided } = parseFlags(args.slice(1), {
      interval: { type: 'string', default: '10m' },
      keep: { type: 'string', default: '20' },
      once: { type: 'boolean' },
    });
    const intervalRaw = flags.interval || '10m';
    const m = intervalRaw.match(/^(\d+)([smh])$/);
    if (!m) { err(`--interval 格式错误: ${intervalRaw}（应为如 30s / 5m / 1h）`); return; }
    const ms = parseInt(m[1], 10) * (m[2] === 's' ? 1000 : m[2] === 'm' ? 60000 : 3600000);
    const once = !!flags.once;
    const dryRunMode = globalOptions.dryRun;

    info(`开始监听配置文件，每 ${intervalRaw} 检测一次 (保留 ${flags.keep})${once ? ' [一次性]' : ''}${dryRunMode ? ' [DRY-RUN]' : ''}`);
    let lastHash = '';
    let lastBackupName = null;
    let ticks = 0;
    let backupsCreated = 0;

    const tick = async () => {
      ticks++;
      try {
        if (!(await fileExists(CONFIG_PATH))) {
          warn(`配置文件不存在: ${CONFIG_PATH}`);
          return;
        }
        const content = await fs.readFile(CONFIG_PATH, 'utf-8');
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        if (hash !== lastHash) {
          if (lastHash !== '') {
            if (dryRunMode) {
              const ts = new Date().toISOString().replace(/[:.]/g, '-');
              const fakeName = `opencode-${ts}.json`;
              info(`[DRY-RUN] 检测到变更，应备份到: ${fakeName} (大小 ${content.length} 字节)`);
              lastBackupName = fakeName;
            } else {
              const name = await backupConfig();
              if (name) {
                ok(`自动备份: ${name}`);
                backupsCreated++;
                lastBackupName = name;
                await appendAuditLog('backup.auto', { name });
              }
            }
          }
          lastHash = hash;
        }
      } catch (e) { warn(`监听错误: ${e.message}`); }
    };

    await tick();

    if (once) {
      const summary = { mode: 'once', ticks, backupsCreated, lastBackupName, dryRun: dryRunMode };
      if (globalOptions.json) jsonOut(summary);
      else info(`一次性检测完成 (ticks=${ticks}, backups=${backupsCreated})`);
      return;
    }

    const timer = setInterval(tick, ms);
    let stopped = false;
    const shutdown = (signal) => {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      const summary = { mode: 'watch', signal, ticks, backupsCreated, lastBackupName, dryRun: dryRunMode };
      if (globalOptions.json) jsonOut(summary);
      else info(`收到 ${signal}，已停止监听 (ticks=${ticks}, backups=${backupsCreated})`);
      process.exit(0);
    };
    process.on('SIGINT',  () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    info('按 Ctrl+C 可停止监听');
    // 永远不退出（除非收到信号）
    await new Promise(() => {});
  } else {
    console.log('用法: backup <create|list|restore|delete|cleanup|diff|watch> [参数]');
  }
}

// ---- rollback: 一键回滚 ----
async function cmdRollback(args) {
  // 读取所有备份
  let files = [];
  try {
    files = await fs.readdir(BACKUPS_DIR);
  } catch {}
  if (files.length === 0) {
    console.log('没有可用的备份，无法回滚');
    return;
  }
  files.sort().reverse();

  // 解析参数
  const { flags } = parseFlags(args, {
    latest: { type: 'boolean', alias: 'l' },
  });

  //  --latest: 直接恢复到最新备份
  if (flags.latest) {
    const id = files[0];
    const stat = await fs.stat(path.join(BACKUPS_DIR, id));
    console.log(`正在恢复到最新备份: ${id}`);
    console.log(`  创建时间: ${stat.mtime.toLocaleString()}`);
    console.log(`  文件大小: ${(stat.size / 1024).toFixed(1)} KB`);
    try {
      const data = await readJSON(path.join(BACKUPS_DIR, id));
      if (!data) { console.log('备份文件无效'); return; }
      await writeConfig(data);
      await appendAuditLog('config.rollback', { id });
      console.log(`✓ 已成功回滚到 ${id}`);
    } catch (e) { console.log(`回滚失败: ${e.message}`); }
    return;
  }

  // 指定备份文件名直接恢复
  if (args.length > 0 && !args[0].startsWith('-')) {
    const id = args[0];
    if (!files.includes(id)) {
      console.log(`备份文件 "${id}" 不存在`);
      console.log('使用 rollback 查看可用备份列表');
      return;
    }
    const stat = await fs.stat(path.join(BACKUPS_DIR, id));
    console.log(`将回滚到: ${id}`);
    console.log(`  创建时间: ${stat.mtime.toLocaleString()}`);
    console.log(`  文件大小: ${(stat.size / 1024).toFixed(1)} KB`);
    // 二次确认
    const ok = await confirmPrompt('确认回滚？当前配置将被覆盖 (y/N): ');
    if (!ok) { console.log('已取消'); return; }
    try {
      const data = await readJSON(path.join(BACKUPS_DIR, id));
      if (!data) { console.log('备份文件无效'); return; }
      await writeConfig(data);
      await appendAuditLog('config.rollback', { id });
      console.log(`✓ 已成功回滚到 ${id}`);
    } catch (e) { console.log(`回滚失败: ${e.message}`); }
    return;
  }

  // 交互模式: 显示编号列表让用户选择
  console.log(`可用备份 (${files.length}):\n`);
  const items = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const stat = await fs.stat(path.join(BACKUPS_DIR, f));
    const size = (stat.size / 1024).toFixed(1);
    const time = stat.mtime.toLocaleString();
    console.log(`  [${i + 1}] ${f}`);
    console.log(`      时间: ${time}  大小: ${size} KB`);
    items.push({ id: f, stat });
  }
  console.log('');
  const choice = await promptInput(`请选择要回滚的备份编号 (1-${files.length}) 或按回车取消: `);
  if (!choice) { console.log('已取消'); return; }
  const idx = parseInt(choice, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= files.length) {
    console.log('无效的选择');
    return;
  }
  const selected = items[idx];
  const ok = await confirmPrompt(`确认回滚到 ${selected.id}？当前配置将被覆盖 (y/N): `);
  if (!ok) { console.log('已取消'); return; }
  try {
    const data = await readJSON(path.join(BACKUPS_DIR, selected.id));
    if (!data) { console.log('备份文件无效'); return; }
    await writeConfig(data);
    await appendAuditLog('config.rollback', { id: selected.id });
    console.log(`✓ 已成功回滚到 ${selected.id}`);
  } catch (e) { console.log(`回滚失败: ${e.message}`); }
}

// ---- format: 格式化 opencode.json ----
async function cmdFormat(args) {
  const config = await readConfig();
  const target = args[0] || CONFIG_PATH;
  if (globalOptions.dryRun) {
    info(`[DRY-RUN] 将格式化: ${target}`);
    console.log(JSON.stringify(config, null, 2));
    return;
  }
  await writeJSON(target, config);
  await appendAuditLog('config.format', { target });
  ok(`已格式化: ${target}`);
}

// ---- diff: 对比配置差异 ----
function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ak = Object.keys(a), bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

function diffObject(a, b, path = '') {
  const changes = [];
  const seen = new Set();
  for (const k of Object.keys(a || {})) {
    seen.add(k);
    const sub = path ? `${path}.${k}` : k;
    if (!(k in (b || {}))) {
      changes.push({ op: 'remove', path: sub, old: a[k] });
    } else if (!deepEqual(a[k], b[k])) {
      if (typeof a[k] === 'object' && a[k] !== null && typeof b[k] === 'object' && b[k] !== null) {
        changes.push(...diffObject(a[k], b[k], sub));
      } else {
        changes.push({ op: 'replace', path: sub, old: a[k], new: b[k] });
      }
    }
  }
  for (const k of Object.keys(b || {})) {
    if (!seen.has(k)) {
      const sub = path ? `${path}.${k}` : k;
      changes.push({ op: 'add', path: sub, new: b[k] });
    }
  }
  return changes;
}

async function cmdDiff(args) {
  if (args.length === 0) {
    console.log('用法:');
    console.log('  diff <文件a> <文件b>            对比两个文件');
    console.log('  diff import <文件>              对比当前配置与待导入文件');
    console.log('  diff rollback <备份文件>        对比当前配置与待恢复备份');
    return;
  }

  const sub = args[0];
  let left, right, leftLabel, rightLabel;

  if (sub === 'import') {
    const file = args[1];
    if (!file) { console.log('用法: diff import <文件>'); return; }
    left = await readConfig();
    right = await readJSON(file);
    if (!right) { err(`无法读取 ${file}`); return; }
    leftLabel = 'current'; rightLabel = file;
  } else if (sub === 'rollback') {
    const id = args[1];
    if (!id) { console.log('用法: diff rollback <备份文件>'); return; }
    left = await readConfig();
    right = await readJSON(path.join(BACKUPS_DIR, id));
    if (!right) { err(`无法读取备份 ${id}`); return; }
    leftLabel = 'current'; rightLabel = id;
  } else if (args.length >= 2) {
    left = await readJSON(args[0]);
    right = await readJSON(args[1]);
    if (!left || !right) { err('无法读取其中一个文件'); return; }
    leftLabel = args[0]; rightLabel = args[1];
  } else {
    console.log('用法: diff <文件a> <文件b>');
    return;
  }

  // 对比"current → target"：以 right 为目标
  const changes = diffObject(left, right);

  if (globalOptions.json) {
    jsonOut({ left: leftLabel, right: rightLabel, changes });
    return;
  }

  if (changes.length === 0) {
    ok('没有差异');
    return;
  }

  console.log(`差异 (${leftLabel} → ${rightLabel}): ${changes.length} 项`);
  for (const c of changes) {
    if (c.op === 'add') {
      console.log(`  + ${c.path} = ${JSON.stringify(c.new)}`);
    } else if (c.op === 'remove') {
      console.log(`  - ${c.path} = ${JSON.stringify(c.old)}`);
    } else {
      console.log(`  ~ ${c.path}: ${JSON.stringify(c.old)} → ${JSON.stringify(c.new)}`);
    }
  }
}

// ---- doctor: 健康检查 ----
async function cmdDoctor(args) {
  const config = await readConfig();
  const issues = [];
  const warnings = [];
  const passed = [];
  const fix = args.includes('--fix') || args.includes('-f');

  // 1. JSON 语法
  try {
    await fs.readFile(CONFIG_PATH, 'utf-8');
    JSON.parse(await fs.readFile(CONFIG_PATH, 'utf-8'));
    passed.push('配置 JSON 语法正确');
  } catch (e) {
    issues.push(`配置 JSON 无效: ${e.message}`);
  }

  // 2. provider
  const providers = config.provider || {};
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
    const [pname, mid] = config.model.split('/');
    if (!providers[pname]) {
      issues.push(`默认 model ${config.model}: provider "${pname}" 不存在`);
    } else if (mid && (!providers[pname].models || !providers[pname].models[mid])) {
      issues.push(`默认 model ${config.model}: 模型 "${mid}" 在 ${pname} 中未定义`);
    }
  }
  if (config.small_model) {
    const [pname, mid] = config.small_model.split('/');
    if (!providers[pname]) {
      issues.push(`small_model ${config.small_model}: provider "${pname}" 不存在`);
    } else if (mid && (!providers[pname].models || !providers[pname].models[mid])) {
      issues.push(`small_model ${config.small_model}: 模型 "${mid}" 在 ${pname} 中未定义`);
    }
  }

  // 4. agent 引用
  const agents = config.agent || {};
  for (const [name, a] of Object.entries(agents)) {
    if (a.model) {
      const [pname, mid] = a.model.split('/');
      if (!providers[pname]) {
        issues.push(`agent ${name}: 引用了不存在的 provider ${pname}`);
      } else if (mid && (!providers[pname].models || !providers[pname].models[mid])) {
        issues.push(`agent ${name}: 引用了不存在的模型 ${a.model}`);
      }
    }
  }

  // 5. default_agent
  if (config.default_agent) {
    if (!agents[config.default_agent]) {
      warnings.push(`default_agent ${config.default_agent} 在 config.agent 中未定义`);
    }
  }

  // 6. skill 路径
  const skills = config.skills || {};
  for (const p of (skills.paths || [])) {
    try { await fs.access(p); } catch { warnings.push(`技能路径不存在: ${p}`); }
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
      } catch {}
    }
  } catch {}
  if (backupCount > 50) {
    warnings.push(`备份数量过多: ${backupCount} 个，建议清理 (backup cleanup)`);
  }

  if (fix) {
    const fixed = [];
    if (!config.provider) { config.provider = {}; fixed.push('创建 provider 对象'); }
    if (!config.skills) { config.skills = {}; fixed.push('创建 skills 对象'); }
    if (!config.tools) { config.tools = {}; fixed.push('创建 tools 对象'); }
    if (Object.keys(config.provider || {}).length === 0) fixed.push('provider 为空，未修改');
    if (Object.keys(config.skills || {}).length === 0) fixed.push('skills 为空，未修改');
    if (Object.keys(config.tools || {}).length === 0) fixed.push('tools 为空，未修改');

    if (!globalOptions.dryRun && fixed.length > 0) {
      await writeConfig(config);
      await appendAuditLog('doctor.fix', { fixed });
    }

    if (globalOptions.json) {
      jsonOut({ fix, fixed, issues, warnings, passed });
      return;
    }

    for (const line of fixed) info(`[FIX] ${line}`);
  }

  if (globalOptions.json) {
    jsonOut({ issues, warnings, passed, summary: { providers: Object.keys(providers).length, agents: Object.keys(agents).length, backups: backupCount, backupSize } });
    return;
  }

  console.log('========================================');
  console.log('  Opencode 配置健康检查');
  console.log('========================================');
  for (const p of passed) ok(p);
  for (const w of warnings) warn(w);
  for (const i of issues) err(i);

  console.log('----------------------------------------');
  console.log(`  providers: ${Object.keys(providers).length}`);
  console.log(`  agents:    ${Object.keys(agents).length}`);
  console.log(`  backups:   ${backupCount} (${(backupSize / 1024).toFixed(1)} KB)`);
  console.log('----------------------------------------');
  if (issues.length === 0) {
    ok('健康检查通过 ✓');
  } else {
    err(`发现 ${issues.length} 个问题`);
    process.exit(1);
  }
}

// ---- provider test: 连通性测试 ----
async function cmdProviderTest(args) {
  const config = await readConfig();
  const targets = args.length > 0 ? args : Object.keys(config.provider || {});

  if (targets[0] === 'all') {
    args.shift();
  }
  const realTargets = args.length > 0 ? args : Object.keys(config.provider || {});

  if (realTargets.length === 0) { err('没有可测试的 provider'); return; }

  const results = [];
  for (const name of realTargets) {
    const p = config.provider?.[name];
    if (!p) { warn(`provider ${name} 不存在`); continue; }
    const baseURL = p.options?.baseURL;
    const apiKey = p.options?.apiKey;
    if (!baseURL) { warn(`provider ${name} 缺少 baseURL`); continue; }
    info(`测试 ${name} (${baseURL})...`);
    const start = Date.now();
    let okFlag = false;
    let models = 0;
    let errMsg = null;
    try {
      const r = await fetch(`${baseURL.replace(/\/+$/, '')}/models`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) {
        const data = await r.json();
        const list = data.data || data || [];
        models = Array.isArray(list) ? list.length : 0;
        okFlag = true;
      } else {
        errMsg = `HTTP ${r.status}`;
      }
    } catch (e) {
      errMsg = e.message;
    }
    const ms = Date.now() - start;
    results.push({ name, baseURL, ok: okFlag, ms, models, err: errMsg });
    if (okFlag) ok(`${name}: 通过 (${ms}ms, ${models} 个模型)`);
    else err(`${name}: 失败 (${errMsg})`);
  }

  if (globalOptions.json) jsonOut({ results });
}

// ---- provider estimate: token/价格预估 ----
async function cmdProviderEstimate(args) {
  if (args.length < 1) {
    console.log('用法: provider estimate <provider> [model] --input <N> --output <N>');
    return;
  }
  const pname = args[0];
  const { flags, provided } = parseFlags(args.slice(1), {
    input: { type: 'number' },
    output: { type: 'number' },
    model: { type: 'string' },
  });

  const config = await readConfig();
  const provider = config.provider?.[pname];
  if (!provider) { err(`provider ${pname} 不存在`); return; }
  const models = provider.models || {};
  const mid = flags.model || (config.model?.startsWith(`${pname}/`) ? config.model.split('/')[1] : Object.keys(models)[0]);
  const model = models[mid];
  if (!model) { err(`model ${mid} 在 ${pname} 中未定义`); return; }
  const inputTokens = provided.has('input') ? flags.input : 1000;
  const outputTokens = provided.has('output') ? flags.output : 500;

  const cost = model.cost || {};
  const inputCost = cost.input ? (inputTokens / 1_000_000) * cost.input : null;
  const outputCost = cost.output ? (outputTokens / 1_000_000) * cost.output : null;
  const total = (inputCost || 0) + (outputCost || 0);

  if (globalOptions.json) {
    jsonOut({ provider: pname, model: mid, inputTokens, outputTokens, inputCost, outputCost, total, currency: 'USD' });
    return;
  }
  console.log(`估算: ${pname}/${mid}`);
  console.log(`  input:  ${inputTokens} tokens`);
  console.log(`  output: ${outputTokens} tokens`);
  if (cost.input)  console.log(`  cost input:  $${(inputCost || 0).toFixed(6)}`);
  if (cost.output) console.log(`  cost output: $${(outputCost || 0).toFixed(6)}`);
  if (cost.input || cost.output) console.log(`  total: $${total.toFixed(6)} USD`);
  else console.log('  cost: (未配置价格)');
  if (model.limit?.context) console.log(`  context limit: ${model.limit.context}`);
  if (model.limit?.output)  console.log(`  output limit:  ${model.limit.output}`);
}

// ---- provider doctor: 提供商检查 ----
async function cmdProviderDoctor(args) {
  const config = await readConfig();
  const providers = config.provider || {};
  const issues = [];
  const warnings = [];
  const reports = [];
  const fix = args.includes('--fix') || args.includes('-f');
  const fixed = [];

  for (const [name, p] of Object.entries(providers)) {
    const rep = { name, ok: true, issues: [], warnings: [] };
    if (fix) {
      if (!p.options) { p.options = {}; fixed.push(`provider ${name}: 创建 options`); }
      if (!p.models) { p.models = {}; fixed.push(`provider ${name}: 创建 models`); }
    }
    const baseURL = p.options?.baseURL;
    if (!baseURL) {
      rep.ok = false;
      rep.issues.push('缺少 baseURL');
      issues.push(`provider ${name}: 缺少 baseURL`);
    }
    if (!p.options?.apiKey) {
      rep.warnings.push('缺少 apiKey');
      warnings.push(`provider ${name}: 缺少 apiKey`);
    }
    if (!p.models || Object.keys(p.models).length === 0) {
      rep.warnings.push('没有配置模型');
      warnings.push(`provider ${name}: 没有配置模型`);
    }

    if (baseURL) {
      try {
        const r = await fetch(`${baseURL.replace(/\/+$/, '')}/models`, {
          headers: p.options?.apiKey ? { Authorization: `Bearer ${p.options.apiKey}` } : {},
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) {
          rep.ok = false;
          rep.issues.push(`连通性失败: HTTP ${r.status}`);
          issues.push(`provider ${name}: HTTP ${r.status}`);
        }
      } catch (e) {
        rep.ok = false;
        rep.issues.push(`连通性失败: ${e.message}`);
        issues.push(`provider ${name}: ${e.message}`);
      }
    }

    reports.push(rep);
  }

  if (globalOptions.json) {
    jsonOut({ issues, warnings, reports, fixed });
    if (fix && !globalOptions.dryRun && fixed.length > 0) {
      await writeConfig(config);
      await appendAuditLog('provider.doctor.fix', { fixed });
    }
    return;
  }

  console.log(`提供商检查 (${reports.length}):`);
  for (const rep of reports) {
    console.log(`  ${rep.name}: ${rep.ok ? 'OK' : 'FAIL'}`);
    for (const w of rep.warnings) console.log(`    [WARN] ${w}`);
    for (const i of rep.issues) console.log(`    [ERR] ${i}`);
  }
  for (const line of fixed) info(`[FIX] ${line}`);
  if (fix && !globalOptions.dryRun && fixed.length > 0) {
    await writeConfig(config);
    await appendAuditLog('provider.doctor.fix', { fixed });
  }
  if (issues.length === 0) ok('provider 检查通过');
  else err(`发现 ${issues.length} 个问题`);
}

// ---- agent doctor: agent 文件检查 ----
async function cmdAgentDoctor(args) {
  let files = [];
  try { files = (await fs.readdir(AGENTS_DIR)).filter(f => f.endsWith('.md')); } catch {}
  const issues = [];
  const warnings = [];
  for (const f of files) {
    const full = path.join(AGENTS_DIR, f);
    const content = await fs.readFile(full, 'utf-8');
    // 检查 frontmatter
    if (!content.startsWith('---')) {
      issues.push(`${f}: 缺少 YAML frontmatter`);
      continue;
    }
    const endIdx = content.indexOf('\n---', 3);
    if (endIdx === -1) {
      issues.push(`${f}: frontmatter 未闭合`);
      continue;
    }
    const fm = content.slice(3, endIdx);
    // 必要字段
    for (const key of ['description', 'mode']) {
      if (!new RegExp(`^${key}:`, 'm').test(fm)) {
        warnings.push(`${f}: frontmatter 缺少 ${key}`);
      }
    }
    // mode 校验
    const modeMatch = fm.match(/^mode:\s*(\S+)/m);
    if (modeMatch && !['primary', 'subagent', 'all'].includes(modeMatch[1])) {
      issues.push(`${f}: mode 必须是 primary|subagent|all，实际为 "${modeMatch[1]}"`);
    }
    // permission 格式
    if (/^permission:/m.test(fm)) {
      const permBlock = fm.split(/^permission:/m)[1] || '';
      if (/:[^#\n]+\n(?!\s*-)/m.test(permBlock) && !/^\s+\w+:/m.test(permBlock)) {
        warnings.push(`${f}: permission 格式可能不标准`);
      }
    }
  }
  if (globalOptions.json) { jsonOut({ issues, warnings, count: files.length }); return; }
  console.log(`agent 文件检查 (${files.length} 个):`);
  for (const w of warnings) warn(w);
  for (const i of issues) err(i);
  if (issues.length === 0 && warnings.length === 0) ok('所有 agent 文件正常');
}

// ---- key: API Key 管理 ----
const KEY_STORE_PATH = path.join(CONFIG_DIR, '.keys.json');

async function loadKeyStore() {
  return (await readJSON(KEY_STORE_PATH)) || {};
}

async function saveKeyStore(store) {
  if (globalOptions.dryRun) { info(`[DRY-RUN] 将写入: ${KEY_STORE_PATH}`); return; }
  await writeJSON(KEY_STORE_PATH, store);
}

async function cmdKey(args) {
  const sub = args[0];
  if (!sub || sub === 'list') {
    const store = await loadKeyStore();
    const names = Object.keys(store);
    if (globalOptions.json) { jsonOut(store); return; }
    if (names.length === 0) { console.log('(未存储任何密钥)'); return; }
    console.log(`已存储的密钥 (${names.length}):`);
    for (const n of names) console.log(`  ${n}: ${'*'.repeat(8)} (${store[n].length} 字符)`);
    return;
  }

  if (sub === 'export') {
    const { flags, provided } = parseFlags(args.slice(1), {
      redact: { type: 'boolean', alias: 'r' },
    });
    const target = args.slice(1).find(a => !a.startsWith('-'));
    let store = await loadKeyStore();
    if (provided.has('redact')) {
      const redacted = {};
      for (const [k, v] of Object.entries(store)) {
        const s = String(v || '');
        redacted[k] = s.length > 8 ? `${s.slice(0, 4)}***${s.slice(-4)}` : '***';
      }
      store = redacted;
    }
    if (target) {
      await writeJSON(target, store);
      ok(`密钥已导出到 ${target}`);
    } else {
      jsonOut(store);
    }
    return;
  }

  if (sub === 'import') {
    const filePath = args[1];
    if (!filePath) { console.log('用法: key import <文件路径>'); return; }
    const data = await readJSON(filePath);
    if (!data || typeof data !== 'object' || Array.isArray(data)) { err('导入文件无效'); return; }
    if (globalOptions.dryRun) {
      dryRunPreview([`[DRY-RUN] key.import: ${filePath}`], { action: 'key.import', filePath, keys: Object.keys(data) });
      return;
    }
    const store = await loadKeyStore();
    Object.assign(store, data);
    await saveKeyStore(store);
    await appendAuditLog('key.import', { filePath, keys: Object.keys(data) });
    ok(`密钥已从 ${filePath} 导入`);
    return;
  }

  if (sub === 'set') {
    const name = args[1];
    if (!name) { console.log('用法: key set <名称>'); return; }
    const value = await promptInput(`输入 ${name} 的值: `);
    if (!value) { err('未输入'); return; }
    const store = await loadKeyStore();
    store[name] = value;
    await saveKeyStore(store);
    await appendAuditLog('key.set', { provider: name });
    ok(`密钥 ${name} 已保存到 ${KEY_STORE_PATH}`);
    return;
  }

  if (sub === 'get') {
    const name = args[1];
    if (!name) { console.log('用法: key get <名称>'); return; }
    const store = await loadKeyStore();
    if (!store[name]) { err(`密钥 ${name} 不存在`); return; }
    if (globalOptions.json) jsonOut({ [name]: store[name] });
    else console.log(store[name]);
    return;
  }

  if (sub === 'delete' || sub === 'rm') {
    const name = args[1];
    if (!name) { console.log('用法: key delete <名称>'); return; }
    const store = await loadKeyStore();
    if (!store[name]) { err(`密钥 ${name} 不存在`); return; }
    if (globalOptions.dryRun) {
      info(`[DRY-RUN] 将删除密钥: ${name}`);
      info(`[DRY-RUN] 将写入: ${KEY_STORE_PATH}`);
      return;
    }
    const okFlag = await confirmPrompt(`确认删除密钥 ${name}? (y/N) `);
    if (!okFlag) { console.log('已取消'); return; }
    delete store[name];
    await saveKeyStore(store);
    await appendAuditLog('key.delete', { provider: name });
    ok(`密钥 ${name} 已删除`);
    return;
  }

  console.log('用法: key <list|set|get|delete> [名称]');
}

// ---- template: 配置模板 ----
const TEMPLATE_DIR = path.join(CONFIG_DIR, 'templates');

async function listTemplates() {
  try { return (await fs.readdir(TEMPLATE_DIR)).filter(f => f.endsWith('.json')); } catch { return []; }
}

async function cmdTemplate(args) {
  const sub = args[0];
  if (!sub || sub === 'list') {
    const files = await listTemplates();
    if (globalOptions.json) { jsonOut(files); return; }
    if (files.length === 0) { console.log('(无模板)'); return; }
    console.log(`模板 (${files.length}):`);
    for (const f of files) console.log(`  ${f.replace(/\.json$/, '')}`);
    return;
  }

  if (sub === 'export') {
    const name = args[1];
    if (!name) { console.log('用法: template export <名称> [文件路径]'); return; }
    const src = path.join(TEMPLATE_DIR, `${name}.json`);
    if (!(await fileExists(src))) { err(`模板 ${name} 不存在`); return; }
    const data = await readJSON(src);
    const target = args[2];
    if (target) {
      await writeJSON(target, data);
      ok(`模板已导出到 ${target}`);
    } else {
      jsonOut(data);
    }
    return;
  }

  if (sub === 'import') {
    const name = args[1];
    const filePath = args[2];
    if (!name || !filePath) { console.log('用法: template import <名称> <文件路径>'); return; }
    const data = await readJSON(filePath);
    if (!data) { err(`导入文件无效: ${filePath}`); return; }
    const target = path.join(TEMPLATE_DIR, `${name}.json`);
    await fs.mkdir(TEMPLATE_DIR, { recursive: true });
    if (globalOptions.dryRun) {
      dryRunPreview([`[DRY-RUN] template.import: ${name}`, `[DRY-RUN]   来源: ${filePath}`, `[DRY-RUN]   目标: ${target}`], { action: 'template.import', name, source: filePath, target });
      return;
    }
    await writeJSON(target, data);
    ok(`模板已导入: ${name}`);
    await appendAuditLog('template.import', { name, source: filePath });
    return;
  }

  if (sub === 'save') {
    const name = args[1];
    if (!name) { console.log('用法: template save <名称>'); return; }
    const nameErr = validateName(name);
    if (nameErr) { err(`非法模板名: ${nameErr}`); return; }
    const config = await readConfig();
    const target = path.join(TEMPLATE_DIR, `${name}.json`);
    const exists = await fileExists(target);

    if (globalOptions.dryRun) {
      const keys = topKeys(config);
      dryRunPreview(
        [
          `[DRY-RUN] template.save: ${name} (${exists ? '将覆盖' : '将创建'})`,
          `[DRY-RUN]   目标: ${target}`,
          `[DRY-RUN]   目录: ${exists ? '已存在' : '将自动创建 ' + TEMPLATE_DIR}`,
          `[DRY-RUN]   顶层 key (${keys.length}): ${keys.slice(0, 12).join(', ')}${keys.length > 12 ? '…' : ''}`,
          `[DRY-RUN]   估算大小: ${jsonByteSize(config)} 字节`,
        ],
        { action: 'template.save', name, target, exists, wouldCreateDir: !exists, keys, size: jsonByteSize(config) },
      );
      return;
    }

    await fs.mkdir(TEMPLATE_DIR, { recursive: true });
    await writeJSON(target, config);
    ok(`模板已保存: ${name}${exists ? ' (覆盖)' : ''}`);
    await appendAuditLog('template.save', { name, overwrite: exists });
    return;
  }

  if (sub === 'apply') {
    const name = args[1];
    if (!name) { console.log('用法: template apply <名称>'); return; }
    const src = path.join(TEMPLATE_DIR, `${name}.json`);
    const data = await readJSON(src);
    if (!data) { err(`模板 ${name} 不存在`); return; }
    // 先 diff
    const current = await readConfig();
    const changes = diffObject(current, data);
    if (globalOptions.dryRun) {
      const summary = changes.reduce((acc, c) => { acc[c.op] = (acc[c.op] || 0) + 1; return acc; }, {});
      dryRunPreview(
        [
          `[DRY-RUN] template.apply: ${name}`,
          `[DRY-RUN]   来源: ${src}`,
          `[DRY-RUN]   将变更: ${changes.length} 项 (add=${summary.add || 0} remove=${summary.remove || 0} change=${summary.change || 0})`,
          ...changes.slice(0, 10).map(c => {
            const op = c.op === 'add' ? '+' : c.op === 'remove' ? '-' : '~';
            return `[DRY-RUN]     ${op} ${c.path}`;
          }),
          ...(changes.length > 10 ? [`[DRY-RUN]     ... 还有 ${changes.length - 10} 项`] : []),
        ],
        { action: 'template.apply', name, source: src, changes, changeCount: changes.length },
      );
      return;
    }
    if (!globalOptions.yes) {
      console.log(`将应用模板 ${name}，共 ${changes.length} 项变更:`);
      for (const c of changes.slice(0, 20)) {
        console.log(`  ${c.op === 'add' ? '+' : c.op === 'remove' ? '-' : '~'} ${c.path}`);
      }
      if (changes.length > 20) console.log(`  ... 还有 ${changes.length - 20} 项`);
      const okFlag = await confirmPrompt('确认应用？(y/N) ');
      if (!okFlag) { console.log('已取消'); return; }
    }
    await writeConfig(data);
    ok(`模板 ${name} 已应用`);
    await appendAuditLog('template.apply', { name, changeCount: changes.length });
    return;
  }

  if (sub === 'show') {
    const name = args[1];
    if (!name) { console.log('用法: template show <名称>'); return; }
    const data = await readJSON(path.join(TEMPLATE_DIR, `${name}.json`));
    if (!data) { err(`模板 ${name} 不存在`); return; }
    jsonOut(data);
    return;
  }

  if (sub === 'delete' || sub === 'rm') {
    const name = args[1];
    if (!name) { console.log('用法: template delete <名称>'); return; }
    const target = path.join(TEMPLATE_DIR, `${name}.json`);
    if (!(await fileExists(target))) { err(`模板 ${name} 不存在`); return; }
    if (globalOptions.dryRun) {
      dryRunPreview(
        [`[DRY-RUN] template.delete: ${name}`, `[DRY-RUN]   目标: ${target}`],
        { action: 'template.delete', name, target },
      );
      return;
    }
    if (!globalOptions.yes) {
      const okFlag = await confirmPrompt(`确认删除模板 ${name}? (y/N) `);
      if (!okFlag) { console.log('已取消'); return; }
    }
    await fs.unlink(target);
    ok(`模板 ${name} 已删除`);
    await appendAuditLog('template.delete', { name });
    return;
  }

  console.log('用法: template <list|save|apply|show|delete> [名称]');
}

// ---- profile: 多 profile 切换 ----
const PROFILES_DIR = path.join(CONFIG_DIR, 'profiles');
const ACTIVE_PROFILE_PATH = path.join(CONFIG_DIR, '.active-profile');

async function listProfiles() {
  try { return (await fs.readdir(PROFILES_DIR)).filter(f => f.endsWith('.json')); } catch { return []; }
}

async function getActiveProfile() {
  try {
    const raw = (await fs.readFile(ACTIVE_PROFILE_PATH, 'utf-8')).trim();
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'string') return parsed;
      if (parsed && typeof parsed === 'object' && typeof parsed.name === 'string') return parsed.name;
    } catch {}
    return raw;
  } catch { return null; }
}

async function cmdProfile(args) {
  const sub = args[0];
  if (!sub || sub === 'list') {
    const profiles = await listProfiles();
    const active = await getActiveProfile();
    if (globalOptions.json) { jsonOut({ profiles: profiles.map(f => f.replace(/\.json$/, '')), active }); return; }
    if (profiles.length === 0) { console.log('(无 profile)'); return; }
    console.log(`profile (${profiles.length}):`);
    for (const p of profiles) {
      const marker = p.replace(/\.json$/, '') === active ? '*' : ' ';
      console.log(`  ${marker} ${p.replace(/\.json$/, '')}`);
    }
    if (active) console.log(`当前激活: ${active}`);
    return;
  }

  if (sub === 'export') {
    const hasName = args[1] && !args[1].startsWith('-');
    let name = hasName ? args[1] : await getActiveProfile();
    if (!name) { console.log('当前无激活 profile，且未指定名称'); return; }
    const src = path.join(PROFILES_DIR, `${name}.json`);
    if (!(await fileExists(src))) { err(`profile ${name} 不存在`); return; }
    const data = await readJSON(src);
    const targetArg = hasName ? args[2] : args[1];
    const target = targetArg && !targetArg.startsWith('-') ? targetArg : null;
    if (target) {
      await writeJSON(target, data);
      ok(`profile 已导出到 ${target}`);
    } else {
      jsonOut(data);
    }
    return;
  }

  if (sub === 'import') {
    const name = args[1];
    const filePath = args[2];
    if (!name || !filePath) { console.log('用法: profile import <名称> <文件路径>'); return; }
    const data = await readJSON(filePath);
    if (!data) { err(`导入文件无效: ${filePath}`); return; }
    const target = path.join(PROFILES_DIR, `${name}.json`);
    await fs.mkdir(PROFILES_DIR, { recursive: true });
    if (globalOptions.dryRun) {
      dryRunPreview([`[DRY-RUN] profile.import: ${name}`, `[DRY-RUN]   来源: ${filePath}`, `[DRY-RUN]   目标: ${target}`], { action: 'profile.import', name, source: filePath, target });
      return;
    }
    await writeJSON(target, data);
    ok(`profile 已导入: ${name}`);
    await appendAuditLog('profile.import', { name, source: filePath });
    return;
  }

  if (sub === 'save' || sub === 'create') {
    const name = args[1];
    if (!name) { console.log('用法: profile save <名称>'); return; }
    const nameErr = validateName(name);
    if (nameErr) { err(`非法 profile 名: ${nameErr}`); return; }
    const config = await readConfig();
    const target = path.join(PROFILES_DIR, `${name}.json`);
    const exists = await fileExists(target);

    if (globalOptions.dryRun) {
      const keys = topKeys(config);
      dryRunPreview(
        [
          `[DRY-RUN] profile.save: ${name} (${exists ? '将覆盖' : '将创建'})`,
          `[DRY-RUN]   目标: ${target}`,
          `[DRY-RUN]   顶层 key (${keys.length}): ${keys.slice(0, 12).join(', ')}${keys.length > 12 ? '…' : ''}`,
          `[DRY-RUN]   估算大小: ${jsonByteSize(config)} 字节`,
        ],
        { action: 'profile.save', name, target, exists, wouldCreateDir: !exists, keys, size: jsonByteSize(config) },
      );
      return;
    }

    await fs.mkdir(PROFILES_DIR, { recursive: true });
    await writeJSON(target, config);
    ok(`profile 已保存: ${name}${exists ? ' (覆盖)' : ''}`);
    await appendAuditLog('profile.save', { name, overwrite: exists });
    return;
  }

  if (sub === 'use') {
    const name = args[1];
    if (!name) { console.log('用法: profile use <名称>'); return; }
    const src = path.join(PROFILES_DIR, `${name}.json`);
    const data = await readJSON(src);
    if (!data) { err(`profile ${name} 不存在`); return; }
    const current = await readConfig();
    const changes = diffObject(current, data);

    if (globalOptions.dryRun) {
      dryRunPreview(
        [
          `[DRY-RUN] profile.use: ${name}`,
          `[DRY-RUN]   来源: ${src}`,
          `[DRY-RUN]   将覆盖当前配置: ${changes.length} 项变更`,
        ],
        { action: 'profile.use', name, source: src, changeCount: changes.length, changes },
      );
      return;
    }

    if (!globalOptions.yes) {
      const okFlag = await confirmPrompt(`切换到 profile ${name}？当前配置将被覆盖 (y/N) `);
      if (!okFlag) { console.log('已取消'); return; }
    }
    await writeConfig(data);
    await writeJSON(ACTIVE_PROFILE_PATH, { name });
    ok(`已切换到 profile: ${name}`);
    await appendAuditLog('profile.use', { name });
    return;
  }

  if (sub === 'show') {
    const name = args[1] || await getActiveProfile();
    if (!name) { console.log('当前无激活 profile'); return; }
    const data = await readJSON(path.join(PROFILES_DIR, `${name}.json`));
    if (!data) { err(`profile ${name} 不存在`); return; }
    jsonOut(data);
    return;
  }

  if (sub === 'delete' || sub === 'rm') {
    const name = args[1];
    if (!name) { console.log('用法: profile delete <名称>'); return; }
    const target = path.join(PROFILES_DIR, `${name}.json`);
    if (!(await fileExists(target))) { err(`profile ${name} 不存在`); return; }
    const active = await getActiveProfile();

    if (globalOptions.dryRun) {
      dryRunPreview(
        [
          `[DRY-RUN] profile.delete: ${name}`,
          `[DRY-RUN]   目标: ${target}`,
          active === name ? `[DRY-RUN]   ⚠ 即将删除的是当前激活 profile` : null,
        ].filter(Boolean),
        { action: 'profile.delete', name, target, isActive: active === name },
      );
      return;
    }

    if (!globalOptions.yes) {
      const okFlag = await confirmPrompt(`确认删除 profile ${name}? (y/N) `);
      if (!okFlag) { console.log('已取消'); return; }
    }
    await fs.unlink(target);
    if (active === name) {
      try { await fs.unlink(ACTIVE_PROFILE_PATH); } catch {}
      info(`已同时取消激活 profile (因为它是当前激活的)`);
    }
    ok(`profile ${name} 已删除`);
    await appendAuditLog('profile.delete', { name, wasActive: active === name });
    return;
  }

  console.log('用法: profile <list|save|use|show|delete> [名称]');
}

// ---- log: 操作审计日志 ----
const AUDIT_LOG_PATH = path.join(CONFIG_DIR, 'logs', 'audit.log');

async function appendAuditLog(action, detail) {
  if (globalOptions.dryRun) return;
  await fs.mkdir(path.dirname(AUDIT_LOG_PATH), { recursive: true });
  const line = JSON.stringify({ time: new Date().toISOString(), action, detail }) + '\n';
  await fs.appendFile(AUDIT_LOG_PATH, line, 'utf-8');
}

async function cmdLog(args) {
  const sub = args[0];
  if (!sub || sub === 'tail' || sub === 'list') {
    const limit = parseInt(args[1] || '20', 10);
    let content = '';
    try { content = await fs.readFile(AUDIT_LOG_PATH, 'utf-8'); } catch { console.log('(无日志)'); return; }
    const lines = content.trim().split('\n').filter(Boolean);
    const last = lines.slice(-limit);
    if (globalOptions.json) { jsonOut(last.map(l => JSON.parse(l))); return; }
    for (const l of last) {
      const e = JSON.parse(l);
      console.log(`${e.time}  ${e.action}  ${JSON.stringify(e.detail)}`);
    }
    return;
  }
  if (sub === 'clear') {
    const okFlag = await confirmPrompt('确认清空审计日志？(y/N) ');
    if (!okFlag) return;
    await fs.unlink(AUDIT_LOG_PATH);
    ok('审计日志已清空');
    return;
  }
  console.log('用法: log <tail|list|clear> [数量]');
}

// ---- self update: 自更新 ----
async function cmdSelfUpdate(args) {
  info('当前版本: 1.0.0');
  info('自更新功能尚未实现，建议手动通过 npm update 更新。');
}

// ---- ui: 启动 Web 控制台 ----
async function cmdUI(args) {
  info('启动 Web 控制台...');
  info('请在项目根目录运行: npm run dev');
  info('或运行: npm run panel');
}

// ---- agent create: 创建智能体 ----
async function cmdAgentCreate(args) {
  // agent create <name> --mode <mode> --desc <description> --model <model>
  // 或简写: agent create <name> <mode> <description> [model]
  if (args.length < 2) {
    console.log('用法:');
    console.log('  agent create <名称> [描述] [model]');
    console.log('  agent create <名称> <mode> <描述> [model]   (mode 为 subagent/primary 时)');
    console.log('  agent create <名称> --mode <mode> --desc <描述> --model <模型>');
    console.log('');
    console.log('说明: mode 默认 primary（主代理），指定 subagent 则创建子代理');
    console.log('');
    console.log('示例:');
    console.log('  npm run config -- agent create my-agent "我的主代理"');
    console.log('  npm run config -- agent create my-agent subagent "我的子代理"');
    console.log('  npm run config -- agent create my-agent "描述" opencode/deepseek-v4-flash-free');
    return;
  }

  const name = args[0];
  let mode = 'primary';  // 默认创建主代理
  let description = '';
  let model = '';

  if (args[1] === '--mode' || args[1] === '--desc' || args[1] === '--model') {
    // 命名参数模式: <name> --mode <mode> --desc <desc> --model <model>
    for (let i = 1; i < args.length; i += 2) {
      switch (args[i]) {
        case '--mode':  mode = args[i + 1]; break;
        case '--desc':  description = args[i + 1]; break;
        case '--model': model = args[i + 1]; break;
      }
    }
  } else if (args[1] === 'subagent' || args[1] === 'primary') {
    // 位置参数模式 v1: <name> <mode> <description> [model]
    mode = args[1] || 'primary';
    description = args[2] || '';
    model = args[3] || '';
  } else {
    // 位置参数模式 v2（默认）: <name> <description> [model]   mode 默认为 primary
    description = args[1] || '';
    model = args[2] || '';
  }

  const config = await readConfig();
  if (!config.agent) config.agent = {};

  if (config.agent[name]) {
    console.log(`代理 "${name}" 已存在，覆盖更新`);
  }

  config.agent[name] = { mode, description, ...(model ? { model } : {}) };
  await writeConfig(config);
  await appendAuditLog('agent.create', { name, mode, model: model || null });

  // 同时创建 .md 文件
  const mdPath = path.join(AGENTS_DIR, `${name}.md`);
  const mdContent = `---
description: "${description}"
mode: ${mode}${model ? `\nmodel: "${model}"` : ''}
---

# ${name}

${description}
`;
  await fs.mkdir(AGENTS_DIR, { recursive: true });
  await fs.writeFile(mdPath, mdContent, 'utf-8');

  console.log(`✓ 代理 "${name}" 已创建`);
  console.log(`  mode: ${mode}`);
  console.log(`  desc: ${description}`);
  if (model) console.log(`  model: ${model}`);
  console.log(`  文件: ${mdPath}`);
}

// ---- agent delete: 删除智能体 ----
async function cmdAgentDelete(args) {
  if (args.length === 0) { console.log('用法: agent delete <名称>'); return; }
  const name = args[0];

  const config = await readConfig();

  // 检查代理是否存在
  if (!config.agent || !config.agent[name]) {
    console.log(`错误: 代理 "${name}" 不存在`);
    return;
  }

  // 删除配置中的代理
  delete config.agent[name];

  // 如果 default_agent 是此代理，清除
  const clearedDefault = config.default_agent === name;
  if (clearedDefault) {
    delete config.default_agent;
    console.log(`  已清除 default_agent（引用了 "${name}"）`);
  }

  const mdPath = path.join(AGENTS_DIR, `${name}.md`);

  if (globalOptions.dryRun) {
    info(`[DRY-RUN] 将删除代理配置: ${name}`);
    info(`[DRY-RUN] 将删除文件: ${mdPath}`);
    return;
  }

  await writeConfig(config);
  await appendAuditLog('agent.delete', { name, clearedDefault });

  // 删除 .md 文件
  try {
    await fs.unlink(mdPath);
    console.log(`  已删除文件: ${mdPath}`);
  } catch {
    // .md 文件可能不存在，忽略
  }

  console.log(`✓ 代理 "${name}" 已删除`);
}

// ---- agent update: 更新智能体属性 ----
async function cmdAgentUpdate(args) {
  if (args.length < 2) {
    console.log('用法: agent update <名称> [--desc <描述>] [--model <模型>] [--mode primary|subagent|all] [--color <颜色>] [--steps <步数>] [--hidden true|false]');
    console.log('示例: agent update my-agent --mode primary --desc "新描述" --model opencode/deepseek');
    return;
  }

  const name = args[0];
  const { flags, provided } = parseFlags(args.slice(1), {
    desc:     { type: 'string', alias: 'd' },
    description: { type: 'string' },
    model:    { type: 'string', alias: 'm' },
    mode:     { type: 'string' },
    color:    { type: 'string' },
    steps:    { type: 'number' },
    hidden:   { type: 'boolean' },
    disable:  { type: 'boolean' },
  });

  const config = await readConfig();
  if (!config.agent || !config.agent[name]) {
    console.log(`错误: 代理 "${name}" 不存在`);
    return;
  }

  const agent = config.agent[name];

  // 合并 description 和 desc
  const description = flags.desc || flags.description;

  // 更新字段
  if (description) agent.description = description;
  if (flags.model) agent.model = flags.model;
  if (flags.mode) {
    validateEnum(flags.mode, ['primary', 'subagent', 'all'], 'mode');
    agent.mode = flags.mode;
  }
  if (flags.color) agent.color = flags.color;
  if (flags.steps !== undefined && flags.steps !== false) agent.steps = flags.steps;
  if (flags.hidden !== false) agent.hidden = flags.hidden;
  if (flags.disable !== false) agent.disable = flags.disable;

  await writeConfig(config);
  await appendAuditLog('agent.update', { name, fields: Array.from(provided) });

  // 同步更新 .md 文件
  const mdPath = path.join(AGENTS_DIR, `${name}.md`);
  const mdContent = `---
description: "${agent.description || ''}"
mode: ${agent.mode || 'primary'}${agent.model ? `\nmodel: "${agent.model}"` : ''}${agent.color ? `\ncolor: "${agent.color}"` : ''}${agent.steps ? `\nsteps: ${agent.steps}` : ''}
---

# ${name}

${agent.description || ''}
`;
  await fs.mkdir(AGENTS_DIR, { recursive: true });
  await fs.writeFile(mdPath, mdContent, 'utf-8');

  console.log(`✓ 代理 "${name}" 已更新`);
  console.log(`  mode: ${agent.mode}`);
  console.log(`  desc: ${agent.description}`);
  if (agent.model) console.log(`  model: ${agent.model}`);
  if (agent.color) console.log(`  color: ${agent.color}`);
  if (agent.steps) console.log(`  steps: ${agent.steps}`);
  if (agent.hidden !== undefined) console.log(`  hidden: ${agent.hidden}`);
}

// ---- agent set-permission: 设置代理权限 ----
async function cmdAgentSetPermission(args) {
  if (args.length < 2) {
    console.log('用法: agent set-permission <名称> <工具>=<动作> [<工具2>=<动作2> ...]');
    console.log('  动作: allow | deny | ask');
    console.log('  示例: agent set-permission my-agent Read=allow Bash=deny edit=ask');
    return;
  }

  const name = args[0];
  const permissions = args.slice(1);

  const config = await readConfig();
  if (!config.agent || !config.agent[name]) {
    console.log(`错误: 代理 "${name}" 不存在`);
    return;
  }

  if (!config.agent[name].permission) {
    config.agent[name].permission = {};
  }

  for (const perm of permissions) {
    const eqIdx = perm.indexOf('=');
    if (eqIdx === -1) {
      console.log(`错误: 权限格式无效 "${perm}"，应为 工具=动作`);
      return;
    }
    const tool = perm.slice(0, eqIdx);
    const action = perm.slice(eqIdx + 1);
    validateEnum(action, ['allow', 'deny', 'ask'], `动作(${tool})`);
    config.agent[name].permission[tool] = action;
    console.log(`  ${tool} = ${action}`);
  }

  await writeConfig(config);
  await appendAuditLog('agent.setPermission', { name, permissions });
  console.log(`✓ 代理 "${name}" 权限已更新`);
}

// ============================================================
// MCP 管理
// ============================================================

// ---- mcp add: 添加 MCP 服务器 ----
async function cmdMcpAdd(args) {
  if (args.length < 2) {
    console.log('用法:');
    console.log('  mcp add <名称> --command <命令> [参数...] [--cwd <目录>] [--env KEY=VALUE] [--timeout <ms>]');
    console.log('  mcp add <名称> --url <URL> [--header KEY=VALUE] [--timeout <ms>]');
    console.log('');
    console.log('示例:');
    console.log('  mcp add my-server --command npx @modelcontextprotocol/server-filesystem /path');
    console.log('  mcp add remote-api --url https://api.example.com/mcp --header Authorization=Bearer xxx');
    return;
  }

  const name = args[0];
  const { positional, flags } = parseFlags(args.slice(1), {
    command: { type: 'string' },
    url:     { type: 'string' },
    cwd:     { type: 'string' },
    env:     { type: 'string' },
    header:  { type: 'string' },
    timeout: { type: 'number' },
  });

  if (!flags.command && !flags.url) {
    console.log('错误: 必须指定 --command（本地）或 --url（远程）');
    return;
  }

  if (flags.command && flags.url) {
    console.log('错误: --command 和 --url 不能同时使用');
    return;
  }

  const config = await readConfig();
  if (!config.mcp) config.mcp = {};

  if (flags.command) {
    // 本地 MCP 服务器
    // --command 后的所有 positional 参数作为命令参数
    const cmdArgs = [flags.command, ...positional];
    const mcpConfig = {
      type: 'local',
      command: cmdArgs,
      enabled: true,
    };
    if (flags.cwd) mcpConfig.cwd = flags.cwd;
    if (flags.timeout !== undefined && flags.timeout !== false) mcpConfig.timeout = flags.timeout;
    if (flags.env) {
      mcpConfig.environment = {};
      for (const kv of [flags.env].flat()) {
        const eqIdx = kv.indexOf('=');
        if (eqIdx !== -1) {
          mcpConfig.environment[kv.slice(0, eqIdx)] = kv.slice(eqIdx + 1);
        }
      }
    }
    config.mcp[name] = mcpConfig;
    console.log(`✓ 本地 MCP 服务器 "${name}" 已添加`);
    console.log(`  command: ${cmdArgs.join(' ')}`);
  } else {
    // 远程 MCP 服务器
    const mcpConfig = {
      type: 'remote',
      url: flags.url,
      enabled: true,
    };
    if (flags.timeout !== undefined && flags.timeout !== false) mcpConfig.timeout = flags.timeout;
    if (flags.header) {
      mcpConfig.headers = {};
      for (const kv of [flags.header].flat()) {
        const eqIdx = kv.indexOf('=');
        if (eqIdx !== -1) {
          mcpConfig.headers[kv.slice(0, eqIdx)] = kv.slice(eqIdx + 1);
        }
      }
    }
    config.mcp[name] = mcpConfig;
    console.log(`✓ 远程 MCP 服务器 "${name}" 已添加`);
    console.log(`  url: ${flags.url}`);
  }

  await writeConfig(config);
  await appendAuditLog('mcp.add', { name });
}

// ---- mcp remove: 删除 MCP 服务器 ----
async function cmdMcpRemove(args) {
  if (args.length === 0) { console.log('用法: mcp remove <名称>'); return; }
  const name = args[0];

  const config = await readConfig();
  if (!config.mcp || !config.mcp[name]) {
    console.log(`错误: MCP 服务器 "${name}" 不存在`);
    return;
  }

  delete config.mcp[name];
  await writeConfig(config);
  await appendAuditLog('mcp.remove', { name });
  console.log(`✓ MCP 服务器 "${name}" 已删除`);
}

// ---- mcp toggle: 启用/禁用 MCP 服务器 ----
async function cmdMcpToggle(args) {
  if (args.length === 0) { console.log('用法: mcp toggle <名称>'); return; }
  const name = args[0];

  const config = await readConfig();
  if (!config.mcp || !config.mcp[name]) {
    console.log(`错误: MCP 服务器 "${name}" 不存在`);
    return;
  }

  const current = config.mcp[name].enabled;
  // enabled 可以是 undefined（默认 true）
  config.mcp[name].enabled = current === false ? true : false;
  await writeConfig(config);
  await appendAuditLog('mcp.toggle', { name, enabled: config.mcp[name].enabled });
  console.log(`✓ MCP 服务器 "${name}" → ${config.mcp[name].enabled ? '启用' : '禁用'}`);
}

// ============================================================
// 自定义命令管理
// ============================================================

// ---- command add: 添加自定义命令 ----
async function cmdCommandAdd(args) {
  if (args.length < 2) {
    console.log('用法: command add <名称> --template <模板> [--description <描述>] [--agent <代理>] [--model <模型>] [--variant <变体>] [--subtask]');
    console.log('');
    console.log('示例:');
    console.log('  command add review --template "审查 {{ .FilePath }}" --agent code-reviewer --subtask');
    console.log('  command add test --template "运行测试: {{ .Input }}"');
    console.log('');
    console.log('说明: 自定义命令可通过 @<名称> 在聊天中触发');
    return;
  }

  const name = args[0];
  const { flags } = parseFlags(args.slice(1), {
    template:    { type: 'string', alias: 't' },
    description: { type: 'string', alias: 'd' },
    agent:       { type: 'string', alias: 'a' },
    model:       { type: 'string', alias: 'm' },
    variant:     { type: 'string' },
    subtask:     { type: 'boolean' },
  });

  if (!flags.template) {
    console.log('错误: --template 是必填参数');
    return;
  }

  const config = await readConfig();
  if (!config.command) config.command = {};

  if (config.command[name]) {
    console.log(`命令 "${name}" 已存在，覆盖更新`);
  }

  const cmdConfig = { template: flags.template };
  if (flags.description) cmdConfig.description = flags.description;
  if (flags.agent) cmdConfig.agent = flags.agent;
  if (flags.model) cmdConfig.model = flags.model;
  if (flags.variant) cmdConfig.variant = flags.variant;
  if (flags.subtask) cmdConfig.subtask = true;

  config.command[name] = cmdConfig;
  await writeConfig(config);
  await appendAuditLog('command.add', { name });

  console.log(`✓ 自定义命令 "${name}" 已添加`);
  console.log(`  template: ${flags.template}`);
  if (flags.description) console.log(`  desc: ${flags.description}`);
  if (flags.agent) console.log(`  agent: ${flags.agent}`);
  if (flags.model) console.log(`  model: ${flags.model}`);
}

// ---- command remove: 删除自定义命令 ----
async function cmdCommandRemove(args) {
  if (args.length === 0) { console.log('用法: command remove <名称>'); return; }
  const name = args[0];

  const config = await readConfig();
  if (!config.command || !config.command[name]) {
    console.log(`错误: 自定义命令 "${name}" 不存在`);
    return;
  }

  delete config.command[name];
  await writeConfig(config);
  await appendAuditLog('command.remove', { name });
  console.log(`✓ 自定义命令 "${name}" 已删除`);
}

// ---- command list: 列出自定义命令 ----
async function cmdCommandList(args) {
  const config = await readConfig();
  const commands = config.command || {};

  if (Object.keys(commands).length === 0) {
    console.log('(无自定义命令)');
    return;
  }

  console.log(`自定义命令 (${Object.keys(commands).length}):`);
  for (const [name, cmd] of Object.entries(commands)) {
    const agentStr = cmd.agent ? `  agent=${cmd.agent}` : '';
    const modelStr = cmd.model ? `  model=${cmd.model}` : '';
    const subtaskStr = cmd.subtask ? '  subtask' : '';
    console.log(`  ${name}`);
    console.log(`    template: ${cmd.template}`);
    if (cmd.description) console.log(`    desc: ${cmd.description}`);
    if (agentStr) console.log(`   ${agentStr}`);
    if (modelStr) console.log(`   ${modelStr}`);
    if (subtaskStr) console.log(`   ${subtaskStr}`);
  }
}

// ============================================================
// 提供商管理增强 (provider update / provider list-models)
// ============================================================

// ---- provider update: 更新提供商选项 ----
async function cmdProviderUpdate(args) {
  if (args.length < 2) {
    console.log('用法: provider update <名称> [--timeout <ms>] [--header-timeout <ms>] [--chunk-timeout <ms>] [--set-cache-key true|false] [--base-url <URL>]');
    console.log('示例: provider update agnes-ai --timeout 60000 --base-url https://new-api.example.com/v1');
    return;
  }

  const name = args[0];
  const { flags, provided } = parseFlags(args.slice(1), {
    timeout:        { type: 'number' },
    'header-timeout': { type: 'number' },
    'chunk-timeout':  { type: 'number' },
    'set-cache-key':  { type: 'boolean' },
    'base-url':       { type: 'string' },
  });

  const config = await readConfig();
  if (!config.provider || !config.provider[name]) {
    console.log(`错误: 提供商 "${name}" 不存在`);
    return;
  }

  const provider = config.provider[name];
  if (!provider.options) provider.options = {};

    if (provided.has('timeout')) provider.options.timeout = flags.timeout;
    if (provided.has('header-timeout')) provider.options.headerTimeout = flags['header-timeout'];
    if (provided.has('chunk-timeout')) provider.options.chunkTimeout = flags['chunk-timeout'];
    if (provided.has('set-cache-key')) provider.options.setCacheKey = flags['set-cache-key'];
    if (flags['base-url']) provider.options.baseURL = flags['base-url'];

  // 如果 timeout 是 0 或 false，允许设为 false 来禁用超时
  if (flags.timeout === 0) provider.options.timeout = false;

  await writeConfig(config);
  await appendAuditLog('provider.update', { name, ...provider.options });

  console.log(`✓ 提供商 "${name}" 选项已更新:`);
  for (const [k, v] of Object.entries(provider.options)) {
    console.log(`  ${k} = ${JSON.stringify(v)}`);
  }
}

// ---- provider list-models: 列出提供商模型详情 ----
async function cmdProviderListModels(args) {
  if (args.length === 0) { console.log('用法: provider list-models <名称> [--verbose]'); return; }

  const name = args[0];
  const { flags } = parseFlags(args.slice(1), {
    verbose: { type: 'boolean', alias: 'v' },
  });

  const config = await readConfig();
  if (!config.provider || !config.provider[name]) {
    console.log(`错误: 提供商 "${name}" 不存在`);
    return;
  }

  const provider = config.provider[name];
  const models = provider.models || {};

  if (Object.keys(models).length === 0) {
    console.log(`提供商 "${name}" 没有配置模型`);
    return;
  }

  console.log(`提供商 "${name}" 的模型 (${Object.keys(models).length}):`);
  for (const [id, m] of Object.entries(models)) {
    if (flags.verbose) {
      console.log(`  ${id}`);
      if (m.name && m.name !== id) console.log(`    name: ${m.name}`);
      if (m.family) console.log(`    family: ${m.family}`);
      if (m.status) console.log(`    status: ${m.status}`);
      if (m.reasoning !== undefined) console.log(`    reasoning: ${m.reasoning}`);
      if (m.tool_call !== undefined) console.log(`    tool_call: ${m.tool_call}`);
      if (m.attachment !== undefined) console.log(`    attachment: ${m.attachment}`);
      if (m.experimental) console.log(`    experimental: ${m.experimental}`);
      if (m.cost) {
        console.log(`    cost: input=${m.cost.input}/1M, output=${m.cost.output}/1M`);
        if (m.cost.cache_read) console.log(`          cache_read=${m.cost.cache_read}/1M`);
      }
      if (m.limit) {
        console.log(`    limit: context=${m.limit.context}, output=${m.limit.output}`);
      }
      if (m.modalities) {
        const inMod = m.modalities.input?.join(',') || '';
        const outMod = m.modalities.output?.join(',') || '';
        if (inMod) console.log(`    input_modalities: ${inMod}`);
        if (outMod) console.log(`    output_modalities: ${outMod}`);
      }
      if (m.variants && Object.keys(m.variants).length > 0) {
        console.log(`    variants: ${Object.keys(m.variants).join(', ')}`);
      }
    } else {
      const nameStr = m.name && m.name !== id ? `  (${m.name})` : '';
      const costStr = m.cost ? `  cost: ${m.cost.input}/${m.cost.output}` : '';
      console.log(`  ${id}${nameStr}${costStr}`);
    }
  }
}

// ============================================================
// 引用管理 (references)
// ============================================================

// ---- reference add: 添加引用 ----
async function cmdReferenceAdd(args) {
  if (args.length < 2) {
    console.log('用法:');
    console.log('  reference add <名称> <路径> [--description <描述>] [--hidden]');
    console.log('  reference add <名称> <仓库URL> --branch <分支> [--description <描述>] [--hidden]');
    console.log('');
    console.log('示例:');
    console.log('  reference add my-docs ./docs --description "项目文档"');
    console.log('  reference add my-lib https://github.com/user/repo --branch main --description "工具库"');
    return;
  }

  const name = args[0];
  const value = args[1];
  const { flags } = parseFlags(args.slice(2), {
    description: { type: 'string', alias: 'd' },
    branch:      { type: 'string', alias: 'b' },
    hidden:      { type: 'boolean' },
  });

  const config = await readConfig();
  if (!config.references) config.references = {};

  if (config.references[name]) {
    console.log(`引用 "${name}" 已存在，覆盖更新`);
  }

  // 判断是 Git 仓库还是本地路径
  if (flags.branch || value.match(/^https?:\/\/.+\.git$/i) || value.match(/^git@/)) {
    // Git 仓库引用
    const ref = { repository: value };
    if (flags.branch) ref.branch = flags.branch;
    if (flags.description) ref.description = flags.description;
    if (flags.hidden) ref.hidden = true;
    config.references[name] = ref;
    console.log(`✓ Git 引用 "${name}" 已添加`);
    console.log(`  repository: ${value}`);
    if (flags.branch) console.log(`  branch: ${flags.branch}`);
  } else {
    // 本地路径引用（也支持纯字符串形式）
    if (flags.description || flags.hidden) {
      const ref = { path: value };
      if (flags.description) ref.description = flags.description;
      if (flags.hidden) ref.hidden = true;
      config.references[name] = ref;
    } else {
      // 简单的字符串路径
      config.references[name] = value;
    }
    console.log(`✓ 本地引用 "${name}" 已添加`);
    console.log(`  path: ${value}`);
  }

  if (flags.description) console.log(`  desc: ${flags.description}`);
  if (flags.hidden) console.log('  hidden: true');

  await writeConfig(config);
  await appendAuditLog('reference.add', { name });
}

// ---- reference remove: 删除引用 ----
async function cmdReferenceRemove(args) {
  if (args.length === 0) { console.log('用法: reference remove <名称>'); return; }
  const name = args[0];

  const config = await readConfig();
  if (!config.references || !config.references[name]) {
    console.log(`错误: 引用 "${name}" 不存在`);
    return;
  }

  delete config.references[name];
  await writeConfig(config);
  await appendAuditLog('reference.remove', { name });
  console.log(`✓ 引用 "${name}" 已删除`);
}

// ---- reference list: 列出引用 ----
async function cmdReferenceList(args) {
  const config = await readConfig();
  const refs = config.references || {};

  const { flags } = parseFlags(args, {
    verbose: { type: 'boolean', alias: 'v' },
  });

  if (Object.keys(refs).length === 0) {
    console.log('(无引用)');
    return;
  }

  console.log(`引用 (${Object.keys(refs).length}):`);
  for (const [name, ref] of Object.entries(refs)) {
    if (typeof ref === 'string') {
      if (flags.verbose) {
        console.log(`  ${name}`);
        console.log(`    type: local`);
        console.log(`    path: ${ref}`);
      } else {
        console.log(`  ${name}  [local]  ${ref}`);
      }
    } else if (ref.repository) {
      if (flags.verbose) {
        console.log(`  ${name}`);
        console.log(`    type: git`);
        console.log(`    repository: ${ref.repository}`);
        if (ref.branch) console.log(`    branch: ${ref.branch}`);
        if (ref.description) console.log(`    desc: ${ref.description}`);
        if (ref.hidden) console.log('    hidden: true');
      } else {
        const branchStr = ref.branch ? `  branch=${ref.branch}` : '';
        console.log(`  ${name}  [git]${branchStr}  ${ref.repository}`);
      }
    } else if (ref.path) {
      if (flags.verbose) {
        console.log(`  ${name}`);
        console.log(`    type: local`);
        console.log(`    path: ${ref.path}`);
        if (ref.description) console.log(`    desc: ${ref.description}`);
        if (ref.hidden) console.log('    hidden: true');
      } else {
        console.log(`  ${name}  [local]  ${ref.path}`);
      }
    }
  }
}

// ============================================================
// 高级配置：compaction / tool-output / experimental / attachment / skills
// ============================================================

// ---- compaction: 上下文压缩配置 ----
async function cmdCompaction(args) {
  if (args.length === 0) { console.log('用法: compaction <set|show> ...'); return; }
  const sub = args[0];

  if (sub === 'show') {
    const config = await readConfig();
    const c = config.compaction || {};
    if (Object.keys(c).length === 0) { console.log('(使用默认压缩配置)'); return; }
    console.log('压缩配置:');
    for (const [k, v] of Object.entries(c)) console.log(`  ${k} = ${JSON.stringify(v)}`);
    return;
  }

  if (sub === 'set') {
    const { flags, provided } = parseFlags(args.slice(1), {
      auto:       { type: 'boolean' },
      prune:      { type: 'boolean' },
      'tail-turns': { type: 'number' },
      reserved:   { type: 'number' },
      'preserve-recent-tokens': { type: 'number' },
    });
    const config = await readConfig();
    if (!config.compaction) config.compaction = {};

    if (provided.has('auto')) config.compaction.auto = flags.auto;
    if (provided.has('prune')) config.compaction.prune = flags.prune;
    if (provided.has('tail-turns')) config.compaction.tail_turns = flags['tail-turns'];
    if (provided.has('reserved')) config.compaction.reserved = flags.reserved;
    if (provided.has('preserve-recent-tokens')) config.compaction.preserve_recent_tokens = flags['preserve-recent-tokens'];

    await writeConfig(config);
    await appendAuditLog('compaction.set', { fields: Array.from(provided) });
    console.log('✓ 压缩配置已更新');
    for (const [k, v] of Object.entries(config.compaction)) console.log(`  ${k} = ${JSON.stringify(v)}`);
    return;
  }

  console.log('用法: compaction <set|show> [参数]');
}

// ---- tool-output: 工具输出截断阈值 ----
async function cmdToolOutput(args) {
  if (args.length === 0) { console.log('用法: tool-output <set|show> ...'); return; }
  const sub = args[0];

  if (sub === 'show') {
    const config = await readConfig();
    const t = config.tool_output || {};
    if (Object.keys(t).length === 0) { console.log('(使用默认工具输出阈值)'); return; }
    console.log('工具输出阈值:');
    for (const [k, v] of Object.entries(t)) console.log(`  ${k} = ${v}`);
    return;
  }

  if (sub === 'set') {
    const { flags } = parseFlags(args.slice(1), {
      'max-lines': { type: 'number' },
      'max-bytes': { type: 'number' },
    });
    const config = await readConfig();
    if (!config.tool_output) config.tool_output = {};

    if (flags['max-lines'] !== undefined && flags['max-lines'] !== false) config.tool_output.max_lines = flags['max-lines'];
    if (flags['max-bytes'] !== undefined && flags['max-bytes'] !== false) config.tool_output.max_bytes = flags['max-bytes'];

    await writeConfig(config);
    await appendAuditLog('toolOutput.set', { fields: { max_lines: config.tool_output.max_lines, max_bytes: config.tool_output.max_bytes } });
    console.log('✓ 工具输出阈值已更新');
    for (const [k, v] of Object.entries(config.tool_output)) console.log(`  ${k} = ${v}`);
    return;
  }

  console.log('用法: tool-output <set|show> [参数]');
}

// ---- experimental: 实验性功能 ----
async function cmdExperimental(args) {
  if (args.length === 0) { console.log('用法: experimental <set|list> ...'); return; }
  const sub = args[0];

  if (sub === 'list') {
    const config = await readConfig();
    const exp = config.experimental || {};
    if (Object.keys(exp).length === 0) { console.log('(无实验性功能开启)'); return; }
    console.log('实验性功能:');
    for (const [k, v] of Object.entries(exp)) {
      console.log(`  ${k} = ${JSON.stringify(v)}`);
    }
    return;
  }

  if (sub === 'set') {
    const feature = args[1];
    const value = args[2];
    if (!feature || value === undefined) {
      console.log('用法: experimental set <特性> <true|false|值>');
      console.log('可用特性: batch_tool, openTelemetry, continue_loop_on_deny, disable_paste_summary');
      console.log('         mcp_timeout, primary_tools');
      return;
    }
    const config = await readConfig();
    if (!config.experimental) config.experimental = {};

    // 解析值
    let parsed;
    try { parsed = JSON.parse(value); } catch { parsed = value; }

    // 如果是数字值（如 mcp_timeout 5000），确保是数字
    if (feature === 'mcp_timeout' && typeof parsed === 'string' && !isNaN(Number(parsed))) {
      parsed = Number(parsed);
    }

    config.experimental[feature] = parsed;
    await writeConfig(config);
    await appendAuditLog('experimental.set', { feature, value: parsed });
    console.log(`✓ experimental.${feature} = ${JSON.stringify(parsed)}`);
    return;
  }

  console.log('用法: experimental <set|list> [参数]');
}

// ---- attachment: 附件配置 ----
async function cmdAttachment(args) {
  if (args.length < 3) {
    console.log('用法: attachment set <max-width|max-height|max-bytes> <数字>');
    console.log('示例: attachment set max-width 3000');
    return;
  }

  const sub = args[0];
  if (sub !== 'set') { console.log('用法: attachment set <属性> <值>'); return; }

  const prop = args[1];
  const val = parseInt(args[2], 10);

  if (isNaN(val) || val <= 0) {
    console.log('错误: 值必须为正整数');
    return;
  }

  const validProps = ['max-width', 'max-height', 'max-bytes', 'max_width', 'max_height', 'max_base64_bytes'];
  if (!validProps.includes(prop)) {
    console.log(`错误: 未知属性 "${prop}"，可选: ${validProps.join(', ')}`);
    return;
  }

  const config = await readConfig();
  if (!config.attachment) config.attachment = { image: {} };
  if (!config.attachment.image) config.attachment.image = {};

  // 转换属性名
  const propMap = {
    'max-width': 'max_width',
    'max-height': 'max_height',
    'max-bytes': 'max_base64_bytes',
  };
  const finalProp = propMap[prop] || prop;

  config.attachment.image[finalProp] = val;
  await writeConfig(config);
  await appendAuditLog('attachment.set', { prop: finalProp, value: val });
  console.log(`✓ attachment.image.${finalProp} = ${val}`);
}

// ---- skills: 技能路径管理 ----
async function cmdSkills(args) {
  if (args.length === 0 || args[0] === 'list') {
    // 无参数或 list → 显示技能列表（包含默认路径下的技能）
    // 先显示额外配置的技能路径
    const verbose = args.includes('--verbose') || args.includes('-v');
    const config = await readConfig();
    const skills = config.skills || {};
    const paths = skills.paths || [];
    const urls = skills.urls || [];
    if (paths.length > 0 || urls.length > 0) {
      if (paths.length > 0) { console.log(`额外技能路径 (${paths.length}):`); for (const p of paths) console.log(`  ${p}`); }
      if (urls.length > 0) { console.log(`额外技能 URL (${urls.length}):`); for (const u of urls) console.log(`  ${u}`); }
    } else {
      console.log('(无额外技能路径配置)');
    }

    // 始终扫描默认技能目录，verbose 时展示详情，否则只展示名称
    const seen = new Set();
    let count = 0;
    try {
      const dirs = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
      for (const d of dirs) {
        if (!d.isDirectory()) continue;
        const skillPath = path.join(SKILLS_DIR, d.name, 'SKILL.md');
        if (!(await fileExists(skillPath))) continue;
        const raw = await fs.readFile(skillPath, 'utf-8');
        const nameMatch = raw.match(/^name:\s*(.+)$/m);
        const descMatch = raw.match(/^description:\s*(.+)$/m);
        const sName = nameMatch ? nameMatch[1].trim() : d.name;
        const desc = descMatch ? descMatch[1].trim() : '';
        if (seen.has(sName)) continue;
        seen.add(sName);
        count++;
        if (verbose) console.log(`  ${sName}${desc ? ` — ${desc}` : ''}`);
        else console.log(`  ${sName}`);
      }
    } catch {}
    if (count === 0) console.log('(无技能)');
    return;
  }
  const sub = args[0];

  if (sub === 'create') {
    const name = args[1];
    if (!name) { console.log('用法: skills create <名称> [--description <描述>]'); return; }
    const nameErr = validateName(name);
    if (nameErr) { err(`非法技能名: ${nameErr}`); return; }

    const { flags } = parseFlags(args.slice(2), {
      description: { type: 'string', alias: 'd' },
      hidden: { type: 'boolean' },
      overwrite: { type: 'boolean', alias: 'f' },
    });

    const skillDir = path.join(SKILLS_DIR, name);
    const skillPath = path.join(skillDir, 'SKILL.md');
    const exists = await fileExists(skillPath);
    if (exists && !flags.overwrite && !globalOptions.yes) {
      console.log(`技能 "${name}" 已存在，使用 --overwrite 或 --yes 覆盖`);
      return;
    }

    const description = flags.description || `Use when working with ${name}.`;
    const content = `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n\n${description}\n`;

    if (globalOptions.dryRun) {
      dryRunPreview(
        [
          `[DRY-RUN] skills.create: ${name}${exists ? ' (将覆盖)' : ' (将创建)'}`,
          `[DRY-RUN]   目标目录: ${skillDir}`,
          `[DRY-RUN]   文件: ${skillPath}`,
          `[DRY-RUN]   描述: ${description}`,
        ],
        { action: 'skills.create', name, skillDir, skillPath, exists, description },
      );
      return;
    }

    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(skillPath, content, 'utf-8');
    ok(`技能已创建: ${name}${exists ? ' (覆盖)' : ''}`);
    await appendAuditLog('skill.create', { name, overwrite: exists });
    return;
  }

  if (sub === 'remove' || sub === 'delete' || sub === 'rm') {
    const name = args[1];
    if (!name) { console.log('用法: skills remove <名称>'); return; }
    const nameErr = validateName(name);
    if (nameErr) { err(`非法技能名: ${nameErr}`); return; }
    const skillDir = path.join(SKILLS_DIR, name);
    const skillPath = path.join(skillDir, 'SKILL.md');
    if (!(await fileExists(skillPath))) { err(`技能 ${name} 不存在`); return; }

    if (globalOptions.dryRun) {
      dryRunPreview(
        [
          `[DRY-RUN] skills.remove: ${name}`,
          `[DRY-RUN]   目录: ${skillDir}`,
          `[DRY-RUN]   文件: ${skillPath}`,
        ],
        { action: 'skills.remove', name, skillDir, skillPath },
      );
      return;
    }

    if (!globalOptions.yes) {
      const okFlag = await confirmPrompt(`确认删除技能 ${name}？(y/N) `);
      if (!okFlag) { console.log('已取消'); return; }
    }

    await fs.rm(skillDir, { recursive: true, force: true });
    ok(`技能已删除: ${name}`);
    await appendAuditLog('skill.remove', { name });
    return;
  }

  if (sub === 'show') {
    const name = args[1];
    if (!name) { console.log('用法: skills show <名称>'); return; }
    const nameErr = validateName(name);
    if (nameErr) { err(`非法技能名: ${nameErr}`); return; }
    const skillPath = path.join(SKILLS_DIR, name, 'SKILL.md');
    try {
      const raw = await fs.readFile(skillPath, 'utf-8');
      if (globalOptions.json) jsonOut({ name, path: skillPath, content: raw });
      else console.log(raw);
    } catch {
      err(`技能 ${name} 不存在`);
    }
    return;
  }

  if (sub === 'edit') {
    const name = args[1];
    if (!name) { console.log('用法: skills edit <名称>'); return; }
    const nameErr = validateName(name);
    if (nameErr) { err(`非法技能名: ${nameErr}`); return; }
    const skillPath = path.join(SKILLS_DIR, name, 'SKILL.md');
    if (!(await fileExists(skillPath))) { err(`技能 ${name} 不存在`); return; }
    console.log(`请直接编辑: ${skillPath}`);
    return;
  }

  if (sub === 'doctor') {
    let dirs = [];
    try { dirs = await fs.readdir(SKILLS_DIR, { withFileTypes: true }); } catch {}
    const issues = [];
    const warnings = [];
    const reports = [];
    const fix = args.includes('--fix') || args.includes('-f');
    const fixed = [];

    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const skillDir = path.join(SKILLS_DIR, d.name);
      const skillPath = path.join(skillDir, 'SKILL.md');
      const rep = { name: d.name, ok: true, issues: [], warnings: [] };

      if (!(await fileExists(skillPath))) {
        rep.ok = false;
        rep.issues.push('缺少 SKILL.md');
        issues.push(`${d.name}: 缺少 SKILL.md`);
        reports.push(rep);
        continue;
      }

      const raw = await fs.readFile(skillPath, 'utf-8');
      const nameMatch = raw.match(/^name:\s*(.+)$/m);
      const descMatch = raw.match(/^description:\s*(.+)$/m);
      const fmName = nameMatch ? nameMatch[1].trim() : '';
      const fmDesc = descMatch ? descMatch[1].trim() : '';

      if (fix && (!fmName || fmName !== d.name || !fmDesc)) {
        const nextDesc = fmDesc || `Use when working with ${d.name}.`;
        const next = `---\nname: ${d.name}\ndescription: ${nextDesc}\n---\n\n# ${d.name}\n\n${nextDesc}\n`;
        if (!globalOptions.dryRun) await fs.writeFile(skillPath, next, 'utf-8');
        fixed.push(`${d.name}: 已修复 frontmatter`);
      }

      if (!fmName) {
        rep.ok = false;
        rep.issues.push('frontmatter 缺少 name');
        issues.push(`${d.name}: frontmatter 缺少 name`);
      } else if (fmName !== d.name) {
        rep.ok = false;
        rep.issues.push(`name 与目录名不一致 (${fmName} != ${d.name})`);
        issues.push(`${d.name}: name 与目录名不一致 (${fmName} != ${d.name})`);
      }

      if (!fmDesc) {
        rep.warnings.push('frontmatter 缺少 description');
        warnings.push(`${d.name}: frontmatter 缺少 description`);
      }

      reports.push(rep);
    }

    if (globalOptions.json) {
      jsonOut({ issues, warnings, reports, fixed });
      if (fix && !globalOptions.dryRun && fixed.length > 0) {
        await appendAuditLog('skills.doctor.fix', { fixed });
      }
      return;
    }

    console.log(`技能检查 (${reports.length}):`);
    for (const rep of reports) {
      console.log(`  ${rep.name}: ${rep.ok ? 'OK' : 'FAIL'}`);
      for (const w of rep.warnings) console.log(`    [WARN] ${w}`);
      for (const i of rep.issues) console.log(`    [ERR] ${i}`);
    }
    for (const line of fixed) info(`[FIX] ${line}`);
    if (fix && !globalOptions.dryRun && fixed.length > 0) {
      await appendAuditLog('skills.doctor.fix', { fixed });
    }
    if (issues.length === 0) ok('skills 检查通过');
    else err(`发现 ${issues.length} 个问题`);
    return;
  }

  if (sub === 'list') {
    const config = await readConfig();
    const skills = config.skills || {};
    const paths = skills.paths || [];
    const urls = skills.urls || [];
    if (paths.length === 0 && urls.length === 0) { console.log('(无额外技能路径)'); return; }
    if (paths.length > 0) {
      console.log(`技能目录 (${paths.length}):`);
      for (const p of paths) console.log(`  ${p}`);
    }
    if (urls.length > 0) {
      console.log(`技能 URL (${urls.length}):`);
      for (const u of urls) console.log(`  ${u}`);
    }
    return;
  }

  if (sub === 'add-path') {
    const pathVal = args[1];
    if (!pathVal) { console.log('用法: skills add-path <路径>'); return; }
    const config = await readConfig();
    if (!config.skills) config.skills = {};
    if (!config.skills.paths) config.skills.paths = [];
    if (!config.skills.paths.includes(pathVal)) {
      config.skills.paths.push(pathVal);
      await writeConfig(config);
      await appendAuditLog('skill.addPath', { path: pathVal });
    }
    console.log(`✓ 技能路径已添加: ${pathVal}`);
    return;
  }

  if (sub === 'add-url') {
    const urlVal = args[1];
    if (!urlVal) { console.log('用法: skills add-url <URL>'); return; }
    const config = await readConfig();
    if (!config.skills) config.skills = {};
    if (!config.skills.urls) config.skills.urls = [];
    if (!config.skills.urls.includes(urlVal)) {
      config.skills.urls.push(urlVal);
      await writeConfig(config);
      await appendAuditLog('skill.addUrl', { url: urlVal });
    }
    console.log(`✓ 技能 URL 已添加: ${urlVal}`);
    return;
  }

  console.log('用法: skills <add-path|add-url|list> [参数]');
}

// ============================================================
// 服务器与插件管理
// ============================================================

// ---- server: 服务器配置 ----
async function cmdServer(args) {
  if (args.length === 0) { console.log('用法: server <set|show> ...'); return; }
  const sub = args[0];

  if (sub === 'show') {
    const config = await readConfig();
    const s = config.server || {};
    if (Object.keys(s).length === 0) { console.log('(使用默认服务器配置)'); return; }
    console.log('服务器配置:');
    for (const [k, v] of Object.entries(s)) {
      console.log(`  ${k} = ${Array.isArray(v) ? v.join(', ') : JSON.stringify(v)}`);
    }
    return;
  }

  if (sub === 'set') {
    const { flags, provided } = parseFlags(args.slice(1), {
      port:     { type: 'number' },
      hostname: { type: 'string' },
      mdns:     { type: 'boolean' },
      'mdns-domain': { type: 'string' },
      cors:     { type: 'string' },
    });
    const config = await readConfig();
    if (!config.server) config.server = {};

    if (provided.has('port')) config.server.port = flags.port;
    if (flags.hostname) config.server.hostname = flags.hostname;
    if (provided.has('mdns')) config.server.mdns = flags.mdns;
    if (flags['mdns-domain']) config.server.mdnsDomain = flags['mdns-domain'];
    if (flags.cors) {
      config.server.cors = flags.cors.split(',').map(s => s.trim()).filter(Boolean);
    }

    await writeConfig(config);
    await appendAuditLog('server.set', { fields: Array.from(provided) });
    console.log('✓ 服务器配置已更新');
    for (const [k, v] of Object.entries(config.server)) {
      console.log(`  ${k} = ${Array.isArray(v) ? v.join(', ') : JSON.stringify(v)}`);
    }
    return;
  }

  console.log('用法: server <set|show> [参数]');
}

// ---- plugin: 插件管理 ----
async function cmdPluginInstall(args) {
  // plugin install <module> [--global] [--force]
  const moduleName = args[0];
  if (!moduleName) {
    console.log('用法: plugin install <模块名> [--global] [--force]');
    console.log('示例: plugin install @opencode/plugin-filesystem');
    return;
  }

  const { flags } = parseFlags(args.slice(1), {
    global: { type: 'boolean', alias: 'g' },
    force:  { type: 'boolean', alias: 'f' },
  });

  const config = await readConfig();
  if (!config.plugin) config.plugin = [];

  // 检查是否已安装
  const existing = config.plugin.findIndex(p => {
    if (typeof p === 'string') return p === moduleName;
    if (Array.isArray(p) && p[0] === moduleName) return true;
    return false;
  });

  if (existing !== -1) {
    if (flags.force) {
      // 替换
      config.plugin.splice(existing, 1);
    } else {
      console.log(`插件 "${moduleName}" 已安装。使用 --force 重新安装`);
      // 仍然执行 npm install
    }
  }

  // 如果是全局模式，写入全局配置
  let targetConfig = config;
  if (flags.global) {
    // 全局配置保存在 ~/.config/opencode/opencode.json 同文件
    // 只是标记，后续由 opencode 处理
    config.plugin.push(moduleName);
  } else {
    config.plugin.push(moduleName);
  }

  await writeConfig(targetConfig);
  await appendAuditLog('plugin.install', { module: moduleName, global: !!flags.global });
  console.log(`✓ 插件 "${moduleName}" 已记录到配置`);

  // 尝试 npm install
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const { execSync } = await import('node:child_process');
  try {
    console.log(`  正在安装 ${moduleName}...`);
    execSync(`${npmCmd} install ${moduleName}`, {
      cwd: CONFIG_DIR,
      stdio: 'pipe',
      timeout: 60000,
    });
    console.log(`✓ npm install ${moduleName} 完成`);
  } catch (e) {
    console.log(`  npm install 失败: ${e.message}`);
    console.log('  配置已记录，可稍后手动运行 npm install');
  }
}

async function cmdPluginRemove(args) {
  if (args.length === 0) { console.log('用法: plugin remove <模块名>'); return; }
  const moduleName = args[0];

  const config = await readConfig();
  if (!config.plugin || config.plugin.length === 0) {
    console.log(`错误: 插件 "${moduleName}" 未安装`);
    return;
  }

  const idx = config.plugin.findIndex(p => {
    if (typeof p === 'string') return p === moduleName;
    if (Array.isArray(p) && p[0] === moduleName) return true;
    return false;
  });

  if (idx === -1) {
    console.log(`错误: 插件 "${moduleName}" 未安装`);
    return;
  }

  config.plugin.splice(idx, 1);
  await writeConfig(config);
  await appendAuditLog('plugin.remove', { module: moduleName });
  console.log(`✓ 插件 "${moduleName}" 已移除`);
}

async function cmdPluginList(args) {
  const config = await readConfig();
  const plugins = config.plugin || [];
  if (plugins.length === 0) { console.log('(无插件)'); return; }
  console.log(`插件 (${plugins.length}):`);
  for (const p of plugins) {
    if (typeof p === 'string') console.log(`  ${p}`);
    else if (Array.isArray(p)) console.log(`  ${p[0]}  (带有配置)`);
  }
}

// ---- tools: 工具管理 ----
async function cmdTool(args) {
  const sub = args[0];
  const config = await readConfig();
  if (!config.tools) config.tools = {};

  if (!sub || sub === 'list') {
    const verbose = args.includes('--verbose') || args.includes('-v');
    const entries = Object.entries(config.tools);
    if (entries.length === 0) {
      console.log('工具: (使用默认配置)');
      return;
    }
    console.log(`工具 (${entries.length}):`);
    for (const [name, enabled] of entries) {
      if (verbose) {
        console.log(`  ${name}`);
        console.log(`    enabled: ${enabled ? 'true' : 'false'}`);
      } else {
        console.log(`  ${name}  ${enabled ? '✓' : '✗'}`);
      }
    }
    return;
  }

  if (sub === 'doctor') {
    const issues = [];
    const warnings = [];
    const tools = config.tools || {};
    const entries = Object.entries(tools);

    for (const [name, enabled] of entries) {
      if (typeof enabled !== 'boolean') {
        warnings.push(`工具 ${name}: 值不是布尔值`);
      }
    }

    if (globalOptions.json) {
      jsonOut({ issues, warnings, count: entries.length });
      return;
    }

    console.log(`工具检查 (${entries.length}):`);
    for (const w of warnings) console.log(`  [WARN] ${w}`);
    for (const i of issues) console.log(`  [ERR] ${i}`);
    if (issues.length === 0) ok('tool 检查通过');
    else err(`发现 ${issues.length} 个问题`);
    return;
  }

  if (sub === 'reset') {
    const current = { ...config.tools };
    if (Object.keys(current).length === 0) {
      console.log('工具: (已是默认配置)');
      return;
    }
    if (globalOptions.dryRun) {
      dryRunPreview(
        [`[DRY-RUN] tool.reset: 将清空 ${Object.keys(current).length} 个工具覆盖项`],
        { action: 'tool.reset', before: current },
      );
      return;
    }
    if (!globalOptions.yes) {
      const okFlag = await confirmPrompt('确认重置所有工具配置？(y/N) ');
      if (!okFlag) { console.log('已取消'); return; }
    }
    config.tools = {};
    await writeConfig(config);
    await appendAuditLog('tool.reset', { before: current });
    ok('工具配置已重置为默认');
    return;
  }

  if (args.length < 2) { console.log('用法: tool <toggle|set|reset|list> <名称> [true/false]'); return; }
  const toolName = args[1];

  if (sub === 'toggle') {
    const current = config.tools[toolName];
    config.tools[toolName] = current === false ? true : false;
    await writeConfig(config);
    await appendAuditLog('tool.toggle', { name: toolName, enabled: config.tools[toolName] });
    console.log(`✓ ${toolName} → ${config.tools[toolName] ? '启用' : '禁用'}`);
  } else if (sub === 'set') {
    const val = args[2];
    if (val === undefined) { console.log('用法: tool set <名称> <true|false>'); return; }
    config.tools[toolName] = val === 'true' || val === '1';
    await writeConfig(config);
    await appendAuditLog('tool.set', { name: toolName, enabled: config.tools[toolName] });
    console.log(`✓ ${toolName} → ${config.tools[toolName] ? '启用' : '禁用'}`);
  } else {
    console.log('未知子命令, 可用: toggle, set, reset, list');
  }
}

// ---- set-model / set-small-model / set-default-agent ----
async function cmdSetModel(args) {
  if (args.length === 0) { console.log('用法: set-model <模型名>'); return; }
  const config = await readConfig();
  config.model = args[0];
  await writeConfig(config);
  await appendAuditLog('provider.setModel', { provider: args[0].includes('/') ? args[0].split('/')[0] : null, model: args[0] });
  console.log(`✓ model = ${args[0]}`);
}

async function cmdSetSmallModel(args) {
  if (args.length === 0) { console.log('用法: set-small-model <模型名>'); return; }
  const config = await readConfig();
  config.small_model = args[0];
  await writeConfig(config);
  await appendAuditLog('provider.setModel', { provider: args[0].includes('/') ? args[0].split('/')[0] : null, model: args[0], field: 'small_model' });
  console.log(`✓ small_model = ${args[0]}`);
}

async function cmdSetDefaultAgent(args) {
  if (args.length === 0) { console.log('用法: set-default-agent <代理名>'); return; }
  const config = await readConfig();
  config.default_agent = args[0];
  await writeConfig(config);
  await appendAuditLog('defaultAgent.set', { agent: args[0] });
  console.log(`✓ default_agent = ${args[0]}`);
}

// ---- json get/set: 直接 JSON 路径操作 ----
async function cmdJson(args) {
  if (args.length < 2) { console.log('用法: json <get|set|patch> <路径> [值]'); return; }
  const sub = args[0];
  const jpath = args[1];
  const keys = jpath.split('.');

  const config = await readConfig();

  if (sub === 'get') {
    let val = config;
    for (const k of keys) {
      if (val == null || typeof val !== 'object') { console.log('null'); return; }
      val = val[k];
    }
    if (val === undefined) console.log('null');
    else if (typeof val === 'object') jsonOut(val);
    else console.log(String(val));
  } else if (sub === 'set') {
    const rawVal = args.slice(2).join(' ');
    let val;
    try { val = JSON.parse(rawVal); } catch { val = rawVal; }

    let obj = config;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]] || typeof obj[keys[i]] !== 'object') obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = val;
    if (globalOptions.dryRun) { info(`[DRY-RUN] 将设置 ${jpath} = ${rawVal}`); return; }
    await writeConfig(config);
    ok(`${jpath} = ${rawVal}`);
    await appendAuditLog('json.set', { path: jpath, value: val });
  } else if (sub === 'patch') {
    // json patch <路径> <json-patch-spec>
    // 支持的操作: add / remove / replace / test
    const specStr = args.slice(2).join(' ');
    let spec;
    try { spec = JSON.parse(specStr); }
    catch { err('patch 规格必须是合法 JSON'); return; }
    const op = spec.op;
    const pval = spec.value;
    let obj = config;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]] || typeof obj[keys[i]] !== 'object') {
        if (op === 'add') obj[keys[i]] = {};
        else { err(`路径不存在: ${jpath}`); return; }
      }
      obj = obj[keys[i]];
    }
    const last = keys[keys.length - 1];
    if (op === 'add' || op === 'replace') {
      obj[last] = pval;
    } else if (op === 'remove') {
      delete obj[last];
    } else if (op === 'test') {
      if (JSON.stringify(obj[last]) !== JSON.stringify(pval)) {
        err(`test 失败: 实际值 ${JSON.stringify(obj[last])} !== 期望 ${JSON.stringify(pval)}`);
        process.exit(1);
      }
      ok(`test 通过`);
      return;
    } else { err(`未知操作: ${op}`); return; }
    if (globalOptions.dryRun) { info(`[DRY-RUN] 将 patch ${jpath}: ${op}`); return; }
    await writeConfig(config);
    ok(`patched ${jpath} (${op})`);
    await appendAuditLog('json.patch', { path: jpath, op, value: pval });
  }
}

// ---- help: 帮助 ----
function showHelp() {
  console.log(`
occ — Opencode 配置管理 CLI 工具

用法:
  node scripts/occ.mjs [全局选项] <命令> [参数...]

全局选项:
  --json                         输出可机读 JSON
  -y, --yes                      跳过确认提示
  --dry-run                      预览但不写入
  -q, --quiet                    静默输出
  -v, --verbose                  详细输出
  --no-color                     关闭彩色输出

配置任务强制流程:
  1. 先执行 status 查看当前状态
  2. 再使用 occ 执行变更
  3. 变更后立即验证
  4. 失败时优先回滚

常用命令:
  状态查看:
    status                          显示配置概览
    get <键>                        获取配置值 (如 model, default_agent)
    doctor                          健康检查（providers/models/agents/skills/backups）
    log [tail|clear]                查看/清空审计日志
    list providers                  列出所有提供商
    list models [提供商]             列出模型
    list agents                     列出所有代理
    list tools                      列出所有工具
    tool list [--verbose]           列出工具详情
    tool reset                      重置工具配置
    list skills                     列出所有技能
    list mcp                        列出 MCP 服务器
    list backups                    列出备份

  配置修改:
    set <键> <值>                   设置配置值
    set-model <模型名>              设置主模型
    set-small-model <模型名>        设置轻量模型
    set-default-agent <代理名>      设置默认代理
    tool toggle <工具名>            切换工具开/关
    tool set <工具名> <true|false>  设置工具状态
    format                          格式化 opencode.json

   智能体管理:
    agent create <名称> [模式] <描述> [model]             创建智能体
    agent delete <名称>                                   删除智能体
    agent update <名称> [--desc] [--model] [--mode] ...   更新智能体属性
    agent set-permission <名称> <工具>=<动作> [...]        设置代理权限
    agent doctor                                          检查所有 agent 文件
    list agents [--verbose] [--filter <mode>]             列出代理（--verbose 详情）

   MCP 管理:
    mcp add <名称> --command <命令> [参数...]          添加本地 MCP 服务器
    mcp add <名称> --url <URL> [--header K=V]         添加远程 MCP 服务器
    mcp remove <名称>                                  删除 MCP 服务器
    mcp toggle <名称>                                  启用/禁用 MCP 服务器
    list mcp [--verbose]                               列出 MCP 服务器

   配置快捷设置:
    set logLevel DEBUG|INFO|WARN|ERROR  设置日志级别
    set autoupdate true|false|notify    设置自动更新
    set snapshot true|false             启用/禁用快照
    set share manual|auto|disabled      设置共享行为
    set shell <路径>                    设置默认 Shell
    set username <名称>                 设置用户名
    toggle <键>                         切换布尔值开关
    disabled-providers add|remove|list  管理禁用提供商
    enabled-providers set|clear|list    管理仅限提供商

   提供商管理:
    add provider <URL> [apiKey]              智能添加提供商
    remove provider <名称>                   删除提供商
    provider update <名称> [--timeout] [...]  更新提供商选项
    provider list-models <名称> [--verbose]  列出提供商模型详情
    provider test [名称...]                    测试 provider 连通性
    provider estimate <名称> [--input N] [--output N]  token/价格预估
    provider doctor                           检查所有 provider

   备份与回滚:
     backup create                       创建备份
     backup list                         列出备份
     backup restore <文件名>             恢复备份
     backup delete <文件名>              删除备份
     backup cleanup --keep <N|5d|12h>    按数量/时间清理
     backup diff <a> <b>                 两个备份对比
     backup watch --interval 10m         自动定时备份
     rollback                            一键回滚（交互选择备份）
     rollback <文件名>                   回滚到指定备份
     rollback --latest | -l              一键回滚到最新备份

   差异对比:
     diff <文件a> <文件b>                对比两个文件
     diff import <文件>                  对比当前配置与待导入文件
     diff rollback <备份>                对比当前配置与待回滚备份

   导入导出:
     export [文件路径] [--redact]        导出配置（--redact 脱敏 API Key）
     import <文件路径> [--validate-only]  导入配置 / 仅验证
     validate                            验证配置

   密钥管理:
    key list                            列出已存储的密钥
    key set <名称>                      存储密钥到 .keys.json
    key get <名称>                      读取密钥
    key delete <名称>                   删除密钥
    key export [文件路径] [--redact]    导出密钥
    key import <文件路径>               导入密钥

   模板与 Profile:
     template list|save|apply|show|delete|export|import <名称>   模板管理
     profile list|save|use|show|delete|export|import <名称>      多 profile 切换

   自定义命令:
    command add <名称> --template <模板> [...]   添加自定义命令
    command remove <名称>                       删除自定义命令
    list commands                               列出自定义命令

   引用管理:
    reference add <名称> <路径> [--description]   添加本地引用
    reference add <名称> <URL> --branch <分支>    添加 Git 引用
    reference remove <名称>                       删除引用
    list references                               列出引用

   高级配置:
    compaction set|show [--auto] [--prune] [--tail-turns] [--reserved]   上下文压缩配置
    tool-output set|show [--max-lines] [--max-bytes]                     工具输出阈值
    experimental set|list <特性> <true|false>                             实验性功能开关
    attachment set max-width|max-height|max-bytes <数字>                  图片附件限制
    skills create|remove|show|edit|doctor|add-path|add-url|list|list --verbose 管理技能路径

   服务器与插件:
    server set|show [--port] [--hostname] [--mdns] [--cors]              服务器配置
    plugin install <模块名> [--global] [--force]                         安装插件
    plugin remove <模块名>                                               移除插件
    plugin list                                                           列出插件

   JSON 直接操作:
    json get <路径>                       按 JSON 路径取值
    json set <路径> <值>                  按 JSON 路径设值
    json patch <路径> <{op,value}>        RFC 6902 patch（add/remove/replace/test）

   其他:
    self update                          自更新（占位）
    ui                                   启动 Web 控制台（占位）

   回归测试:
    npm run test:cli                     运行完整命令回归测试
    node scripts/test-cli.mjs            直接执行回归测试脚本

   常用速查:
    status                               查看配置概览
    doctor                               健康检查
    backup list                          查看备份列表
    template list                        查看模板列表
    profile list                         查看 profile 列表
    key list                             查看密钥列表

 示例:
  node scripts/occ.mjs status
  node scripts/occ.mjs get model
  node scripts/occ.mjs set model opencode/deepseek-v4-flash-free
  node scripts/occ.mjs list providers
  node scripts/occ.mjs add provider https://api.openai.com/v1 sk-xxx
  node scripts/occ.mjs tool toggle Read
  node scripts/occ.mjs agent create my-agent subagent "我的自定义代理"
  node scripts/occ.mjs --json doctor
  node scripts/occ.mjs --dry-run set model b-ai/minimax-m3
  node scripts/occ.mjs diff import config.json
  npm run test:cli
`);
}

// ============================================================
// 主入口
// ============================================================
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) { showHelp(); return; }

  // 解析全局选项（允许出现在任意位置）
  const remaining = [];
  let cmd = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--') || a === '-y' || a === '-q' || a === '-v') {
      switch (a) {
        case '--json':     globalOptions.json = true; break;
        case '--yes':
        case '-y':         globalOptions.yes = true; break;
        case '--dry-run':  globalOptions.dryRun = true; break;
        case '--quiet':
        case '-q':         globalOptions.quiet = true; break;
        case '--verbose':
        case '-v':         globalOptions.verbose = true; break;
        case '--no-color': globalOptions.color = false; break;
        default:           remaining.push(a); break;
      }
    } else {
      if (cmd === null) cmd = a;
      else remaining.push(a);
    }
  }

  if (!cmd) { showHelp(); return; }

  try {
    switch (cmd) {
      case 'get':              await cmdGet(remaining); break;
      case 'set':              await cmdSet(remaining); break;
      case 'toggle':           await cmdToggle(remaining); break;
      case 'reference':
      case 'references':
      case 'ref': {
        const sub = remaining[0];
        if (!sub) { console.log('用法: reference <add|remove|list> ...'); break; }
        switch (sub) {
          case 'add':    await cmdReferenceAdd(remaining.slice(1)); break;
          case 'remove':
          case 'rm':     await cmdReferenceRemove(remaining.slice(1)); break;
          case 'list':
          case 'ls':     await cmdReferenceList(remaining.slice(1)); break;
          default:       console.log(`未知 reference 子命令: ${sub}`); break;
        }
        break;
      }
      case 'command':
      case 'commands': {
        const sub = remaining[0];
        if (!sub) { console.log('用法: command <add|remove|list> ...'); break; }
        switch (sub) {
          case 'add':    await cmdCommandAdd(remaining.slice(1)); break;
          case 'remove':
          case 'rm':     await cmdCommandRemove(remaining.slice(1)); break;
          case 'list':
          case 'ls':     await cmdCommandList(remaining.slice(1)); break;
          default:       console.log(`未知 command 子命令: ${sub}`); break;
        }
        break;
      }
      case 'disabled-providers':
      case 'disabled_providers': await cmdDisabledProviders(remaining); break;
      case 'enabled-providers':
      case 'enabled_providers':   await cmdEnabledProviders(remaining); break;
      case 'list':             await cmdList(remaining); break;
      case 'provider':
      case 'providers': {
        const sub = remaining[0];
        if (!sub) { console.log('用法: provider <update|list-models|add|remove> ...'); break; }
        switch (sub) {
          case 'update':       await cmdProviderUpdate(remaining.slice(1)); break;
          case 'list-models':
          case 'list-m':       await cmdProviderListModels(remaining.slice(1)); break;
          case 'test':         await cmdProviderTest(remaining.slice(1)); break;
          case 'estimate':     await cmdProviderEstimate(remaining.slice(1)); break;
          case 'doctor':       await cmdProviderDoctor(remaining.slice(1)); break;
          default:             console.log(`未知 provider 子命令: ${sub}`); break;
        }
        break;
      }
      case 'add':              await cmdAdd(remaining); break;
      case 'remove':           await cmdRemove(remaining); break;
      case 'status':           await cmdStatus(); break;
      case 'export':           await cmdExport(remaining); break;
      case 'import':           await cmdImport(remaining); break;
      case 'validate':         await cmdValidate(); break;
      case 'format':           await cmdFormat(remaining); break;
      case 'diff':             await cmdDiff(remaining); break;
      case 'doctor':           await cmdDoctor(remaining); break;
      case 'key':              await cmdKey(remaining); break;
      case 'template':         await cmdTemplate(remaining); break;
      case 'profile':          await cmdProfile(remaining); break;
      case 'log':              await cmdLog(remaining); break;
      case 'self': {
        const sub = remaining[0];
        if (sub === 'update') { await cmdSelfUpdate(remaining.slice(1)); break; }
        console.log('用法: self update');
        break;
      }
      case 'ui':               await cmdUI(remaining); break;
      case 'backup':           await cmdBackup(remaining); break;
      case 'rollback':         await cmdRollback(remaining); break;
      case 'compaction':      await cmdCompaction(remaining); break;
      case 'tool-output':
      case 'tool_output':     await cmdToolOutput(remaining); break;
      case 'experimental':    await cmdExperimental(remaining); break;
      case 'attachment':      await cmdAttachment(remaining); break;
      case 'skills':
      case 'skill':           await cmdSkills(remaining); break;
      case 'server':          await cmdServer(remaining); break;
      case 'plugin':
      case 'plugins': {
        const psub = remaining[0];
        if (!psub) { console.log('用法: plugin <install|remove|list> ...'); break; }
        switch (psub) {
          case 'install': await cmdPluginInstall(remaining.slice(1)); break;
          case 'remove':
          case 'rm':      await cmdPluginRemove(remaining.slice(1)); break;
          case 'list':
          case 'ls':      await cmdPluginList(remaining.slice(1)); break;
          default:        console.log(`未知 plugin 子命令: ${psub}`); break;
        }
        break;
      }
      case 'mcp': {
        const sub = remaining[0];
        if (!sub || sub === 'list' || sub === 'ls') {
          // mcp list / mcp list --verbose
          await cmdList(['mcp', ...remaining.slice(1)]);
          break;
        }
        switch (sub) {
          case 'add':    await cmdMcpAdd(remaining.slice(1)); break;
          case 'remove':
          case 'rm':     await cmdMcpRemove(remaining.slice(1)); break;
          case 'toggle': await cmdMcpToggle(remaining.slice(1)); break;
          default:       console.log(`未知 mcp 子命令: ${sub}`); break;
        }
        break;
      }
      case 'tool':
      case 'tools':            await cmdTool(remaining); break;
      case 'set-model':        await cmdSetModel(remaining); break;
      case 'set-small-model':  await cmdSetSmallModel(remaining); break;
      case 'set-default-agent':await cmdSetDefaultAgent(remaining); break;
      case 'json':             await cmdJson(remaining); break;
      case 'agent': {
        const sub = remaining[0];
        if (!sub) { console.log('用法: agent <create|delete|update|set-permission> ...'); break; }
        switch (sub) {
          case 'create':         await cmdAgentCreate(remaining.slice(1)); break;
          case 'delete':
          case 'rm':             await cmdAgentDelete(remaining.slice(1)); break;
          case 'update':         await cmdAgentUpdate(remaining.slice(1)); break;
          case 'set-permission':
          case 'set-perm':       await cmdAgentSetPermission(remaining.slice(1)); break;
          case 'doctor':         await cmdAgentDoctor(remaining.slice(1)); break;
          default:               console.log(`未知 agent 子命令: ${sub}`); break;
        }
        break;
      }
      case 'help':
      case '-h':
      case '--help':           showHelp(); break;
      default:
        console.log(`未知命令: ${cmd}\n`);
        showHelp();
        process.exit(1);
    }
  } catch (e) {
    console.error(`错误: ${e.message}`);
    process.exit(1);
  }
}

main();
