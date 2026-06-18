#!/usr/bin/env node

/**
 * opencode-config — Opencode 配置管理 CLI 工具
 * ==============================================
 * 任意智能体可以通过此命令行工具直接读写 opencode 配置。
 * 无需启动 Express 服务器，直接操作配置文件。
 *
 * 用法:
 *   node scripts/opencode-config.mjs <命令> [参数...]
 *
 * 示例:
 *   node scripts/opencode-config.mjs status
 *   node scripts/opencode-config.mjs list providers
 *   node scripts/opencode-config.mjs get model
 *   node scripts/opencode-config.mjs set model opencode/deepseek-v4-flash-free
 *   node scripts/opencode-config.mjs add provider https://api.openai.com/v1 sk-xxx
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

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

/** 带缩进的 JSON 输出 */
function jsonOut(data) {
  console.log(JSON.stringify(data, null, 2));
}

/** 读取 JSON 文件 */
async function readJSON(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch { return null; }
}

/** 写入 JSON 文件（自动创建目录） */
async function writeJSON(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
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
    console.log(`✓ 已设置仅限提供商: ${names.join(', ')}`);
  } else if (sub === 'clear') {
    delete config.enabled_providers;
    await writeConfig(config);
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

  await writeConfig(config);
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
async function cmdExport(args) {
  const config = await readConfig();
  const filePath = args[0];
  if (filePath) {
    await writeJSON(filePath, config);
    console.log(`✓ 配置已导出到 ${filePath}`);
  } else {
    jsonOut(config);
  }
}

// ---- import: 导入配置 ----
async function cmdImport(args) {
  if (args.length === 0) { console.log('用法: import <文件路径>'); return; }
  const filePath = args[0];
  try {
    const data = await readJSON(filePath);
    if (!data) { console.log('文件无效'); return; }
    await writeConfig(data);
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
    if (name) console.log(`✓ 备份已创建: ${name}`);
    else console.log('备份失败');
  } else if (sub === 'list') {
    try {
      const files = await fs.readdir(BACKUPS_DIR);
      if (files.length === 0) { console.log('(无备份)'); return; }
      console.log(`备份 (${files.length}):`);
      for (const f of files.sort().reverse()) {
        const stat = await fs.stat(path.join(BACKUPS_DIR, f));
        console.log(`  ${f}  (${(stat.size / 1024).toFixed(1)} KB)`);
      }
    } catch { console.log('(无备份)'); }
  } else if (sub === 'restore') {
    const id = args[1];
    if (!id) { console.log('用法: backup restore <备份文件名>'); return; }
    try {
      const data = await readJSON(path.join(BACKUPS_DIR, id));
      if (!data) { console.log('备份文件无效'); return; }
      await writeConfig(data);
      console.log(`✓ 已从 ${id} 恢复`);
    } catch (e) { console.log(`恢复失败: ${e.message}`); }
  } else if (sub === 'delete') {
    const id = args[1];
    if (!id) { console.log('用法: backup delete <备份文件名>'); return; }
    try {
      await fs.unlink(path.join(BACKUPS_DIR, id));
      console.log(`✓ 备份 ${id} 已删除`);
    } catch (e) { console.log(`删除失败: ${e.message}`); }
  } else {
    console.log('用法: backup <create|list|restore|delete> [参数]');
  }
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
  if (config.default_agent === name) {
    delete config.default_agent;
    console.log(`  已清除 default_agent（引用了 "${name}"）`);
  }

  await writeConfig(config);

  // 删除 .md 文件
  const mdPath = path.join(AGENTS_DIR, `${name}.md`);
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
  console.log(`✓ attachment.image.${finalProp} = ${val}`);
}

// ---- skills: 技能路径管理 ----
async function cmdSkills(args) {
  if (args.length === 0 || args[0] === 'list') {
    // 无参数或 list → 显示技能列表（包含默认路径下的技能）
    // 先显示额外配置的技能路径
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
    return;
  }
  const sub = args[0];

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
  if (args.length < 2) { console.log('用法: tool <toggle|set> <名称> [true/false]'); return; }
  const sub = args[0];
  const toolName = args[1];

  const config = await readConfig();
  if (!config.tools) config.tools = {};

  if (sub === 'toggle') {
    const current = config.tools[toolName];
    config.tools[toolName] = current === false ? true : false;
    await writeConfig(config);
    console.log(`✓ ${toolName} → ${config.tools[toolName] ? '启用' : '禁用'}`);
  } else if (sub === 'set') {
    const val = args[2];
    if (val === undefined) { console.log('用法: tool set <名称> <true|false>'); return; }
    config.tools[toolName] = val === 'true' || val === '1';
    await writeConfig(config);
    console.log(`✓ ${toolName} → ${config.tools[toolName] ? '启用' : '禁用'}`);
  } else {
    console.log('未知子命令, 可用: toggle, set');
  }
}

// ---- set-model / set-small-model / set-default-agent ----
async function cmdSetModel(args) {
  if (args.length === 0) { console.log('用法: set-model <模型名>'); return; }
  const config = await readConfig();
  config.model = args[0];
  await writeConfig(config);
  console.log(`✓ model = ${args[0]}`);
}

async function cmdSetSmallModel(args) {
  if (args.length === 0) { console.log('用法: set-small-model <模型名>'); return; }
  const config = await readConfig();
  config.small_model = args[0];
  await writeConfig(config);
  console.log(`✓ small_model = ${args[0]}`);
}

async function cmdSetDefaultAgent(args) {
  if (args.length === 0) { console.log('用法: set-default-agent <代理名>'); return; }
  const config = await readConfig();
  config.default_agent = args[0];
  await writeConfig(config);
  console.log(`✓ default_agent = ${args[0]}`);
}

// ---- json get/set: 直接 JSON 路径操作 ----
async function cmdJson(args) {
  if (args.length < 2) { console.log('用法: json <get|set> <路径> [值]'); return; }
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
    await writeConfig(config);
    console.log(`✓ ${jpath} = ${rawVal}`);
  }
}

// ---- help: 帮助 ----
function showHelp() {
  console.log(`
opencode-config — Opencode 配置管理 CLI 工具

用法:
  node scripts/opencode-config.mjs <命令> [参数...]

常用命令:
  状态查看:
    status                          显示配置概览
    get <键>                        获取配置值 (如 model, default_agent)
    list providers                  列出所有提供商
    list models [提供商]             列出模型
    list agents                     列出所有代理
    list tools                      列出所有工具
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

   智能体管理:
    agent create <名称> [模式] <描述> [model]             创建智能体
    agent delete <名称>                                   删除智能体
    agent update <名称> [--desc] [--model] [--mode] ...   更新智能体属性
    agent set-permission <名称> <工具>=<动作> [...]        设置代理权限
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

  备份管理:
    backup create                   创建备份
    backup list                     列出备份
    backup restore <文件名>         恢复备份
    backup delete <文件名>          删除备份

  导入导出:
    export [文件路径]               导出配置
    import <文件路径>               导入配置
    validate                        验证配置

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
    skills add-path|add-url|list                                         管理技能路径

   服务器与插件:
    server set|show [--port] [--hostname] [--mdns] [--cors]              服务器配置
    plugin install <模块名> [--global] [--force]                         安装插件
    plugin remove <模块名>                                               移除插件
    plugin list                                                           列出插件

   JSON 直接操作:
    json get <路径>                 按 JSON 路径取值
    json set <路径> <值>            按 JSON 路径设值

示例:
  node scripts/opencode-config.mjs status
  node scripts/opencode-config.mjs get model
  node scripts/opencode-config.mjs set model opencode/deepseek-v4-flash-free
  node scripts/opencode-config.mjs list providers
  node scripts/opencode-config.mjs add provider https://api.openai.com/v1 sk-xxx
  node scripts/opencode-config.mjs tool toggle Read
  node scripts/opencode-config.mjs agent create my-agent subagent "我的自定义代理"
`);
}

// ============================================================
// 主入口
// ============================================================
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) { showHelp(); return; }

  const cmd = args[0];

  try {
    switch (cmd) {
      case 'get':              await cmdGet(args.slice(1)); break;
      case 'set':              await cmdSet(args.slice(1)); break;
      case 'toggle':           await cmdToggle(args.slice(1)); break;
      case 'reference':
      case 'references':
      case 'ref': {
        const sub = args[1];
        if (!sub) { console.log('用法: reference <add|remove|list> ...'); break; }
        switch (sub) {
          case 'add':    await cmdReferenceAdd(args.slice(2)); break;
          case 'remove':
          case 'rm':     await cmdReferenceRemove(args.slice(2)); break;
          case 'list':
          case 'ls':     await cmdReferenceList(args.slice(2)); break;
          default:       console.log(`未知 reference 子命令: ${sub}`); break;
        }
        break;
      }
      case 'command':
      case 'commands': {
        const sub = args[1];
        if (!sub) { console.log('用法: command <add|remove|list> ...'); break; }
        switch (sub) {
          case 'add':    await cmdCommandAdd(args.slice(2)); break;
          case 'remove':
          case 'rm':     await cmdCommandRemove(args.slice(2)); break;
          case 'list':
          case 'ls':     await cmdCommandList(args.slice(2)); break;
          default:       console.log(`未知 command 子命令: ${sub}`); break;
        }
        break;
      }
      case 'disabled-providers':
      case 'disabled_providers': await cmdDisabledProviders(args.slice(1)); break;
      case 'enabled-providers':
      case 'enabled_providers':   await cmdEnabledProviders(args.slice(1)); break;
      case 'list':             await cmdList(args.slice(1)); break;
      case 'provider':
      case 'providers': {
        const sub = args[1];
        if (!sub) { console.log('用法: provider <update|list-models|add|remove> ...'); break; }
        switch (sub) {
          case 'update':       await cmdProviderUpdate(args.slice(2)); break;
          case 'list-models':
          case 'list-m':       await cmdProviderListModels(args.slice(2)); break;
          default:             console.log(`未知 provider 子命令: ${sub}`); break;
        }
        break;
      }
      case 'add':              await cmdAdd(args.slice(1)); break;
      case 'remove':           await cmdRemove(args.slice(1)); break;
      case 'status':           await cmdStatus(); break;
      case 'export':           await cmdExport(args.slice(1)); break;
      case 'import':           await cmdImport(args.slice(1)); break;
      case 'validate':         await cmdValidate(); break;
      case 'backup':           await cmdBackup(args.slice(1)); break;
      case 'compaction':      await cmdCompaction(args.slice(1)); break;
      case 'tool-output':
      case 'tool_output':     await cmdToolOutput(args.slice(1)); break;
      case 'experimental':    await cmdExperimental(args.slice(1)); break;
      case 'attachment':      await cmdAttachment(args.slice(1)); break;
      case 'skills':
      case 'skill':           await cmdSkills(args.slice(1)); break;
      case 'server':          await cmdServer(args.slice(1)); break;
      case 'plugin':
      case 'plugins': {
        const psub = args[1];
        if (!psub) { console.log('用法: plugin <install|remove|list> ...'); break; }
        switch (psub) {
          case 'install': await cmdPluginInstall(args.slice(2)); break;
          case 'remove':
          case 'rm':      await cmdPluginRemove(args.slice(2)); break;
          case 'list':
          case 'ls':      await cmdPluginList(args.slice(2)); break;
          default:        console.log(`未知 plugin 子命令: ${psub}`); break;
        }
        break;
      }
      case 'mcp': {
        const sub = args[1];
        if (!sub || sub === 'list' || sub === 'ls') {
          // mcp list / mcp list --verbose
          await cmdList(['mcp', ...args.slice(2)]);
          break;
        }
        switch (sub) {
          case 'add':    await cmdMcpAdd(args.slice(2)); break;
          case 'remove':
          case 'rm':     await cmdMcpRemove(args.slice(2)); break;
          case 'toggle': await cmdMcpToggle(args.slice(2)); break;
          default:       console.log(`未知 mcp 子命令: ${sub}`); break;
        }
        break;
      }
      case 'tool':
      case 'tools':            await cmdTool(args.slice(1)); break;
      case 'set-model':        await cmdSetModel(args.slice(1)); break;
      case 'set-small-model':  await cmdSetSmallModel(args.slice(1)); break;
      case 'set-default-agent':await cmdSetDefaultAgent(args.slice(1)); break;
      case 'json':             await cmdJson(args.slice(1)); break;
      case 'agent': {
        const sub = args[1];
        if (!sub) { console.log('用法: agent <create|delete|update|set-permission> ...'); break; }
        switch (sub) {
          case 'create':         await cmdAgentCreate(args.slice(2)); break;
          case 'delete':
          case 'rm':             await cmdAgentDelete(args.slice(2)); break;
          case 'update':         await cmdAgentUpdate(args.slice(2)); break;
          case 'set-permission':
          case 'set-perm':       await cmdAgentSetPermission(args.slice(2)); break;
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
