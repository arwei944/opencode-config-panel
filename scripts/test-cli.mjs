#!/usr/bin/env node

/**
 * opencode-config (occ) 回归测试脚本
 * ============================================
 * 用临时 HOME 目录隔离真实配置，覆盖所有关键命令的：
 *   - 真实写入路径（不漏文件、不漏 audit）
 *   - --dry-run 行为（不真改盘 + 输出 DRY-RUN 标记）
 *   - --json 结构化输出
 *   - 审计日志格式正确
 *   - 非法输入拒绝
 *   - 优雅退出（backup watch --once）
 *
 * 运行:  node scripts/test-cli.mjs
 * 退出码: 0 全部通过 / 1 有失败 / 2 脚本自身错误
 *
 * 已知 bug 列表（[BUG] 标记的 case 反映了当前 bug 行为，
 *                待 CLI 修复后应改为严格断言）：
 *   - agent delete --dry-run 会真删 .md 文件
  *   - key delete --dry-run 仍会弹 confirmPrompt（除非 --yes）
  *   - provider remove --dry-run 缺少分支，行为半残
 */

import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const CLI_PATH   = path.join(__dirname, 'occ.mjs');

// ============================================================
// 测试结果统计
// ============================================================
const stats = { pass: 0, fail: 0, bug: 0, skip: 0, total: 0 };
const failures = [];

// ============================================================
// 工具函数
// ============================================================

/** 用临时 HOME 目录执行 CLI 命令 */
function runCli(args, {
  home, dryRun = false, yes = false, json = false,
  input = null, timeoutMs = 30000,
} = {}) {
  const fullArgs = [CLI_PATH, '--no-color'];
  if (dryRun) fullArgs.push('--dry-run');
  if (yes)    fullArgs.push('--yes');
  if (json)   fullArgs.push('--json');
  fullArgs.push(...args);

  const env = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    NO_COLOR: '1',
    FORCE_COLOR: '0',
  };

  const r = spawnSync(process.execPath, fullArgs, {
    env,
    encoding: 'utf-8',
    timeout: timeoutMs,
    killSignal: 'SIGKILL',
    windowsHide: true,
    input, // 喂入 stdin
  });

  return {
    code:   r.status ?? -1,
    signal: r.signal ?? null,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    timedOut: r.signal === 'SIGKILL',
  };
}

async function pathExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function readText(p) {
  try { return await fs.readFile(p, 'utf-8'); } catch { return null; }
}

async function readJSONSafe(p) {
  const t = await readText(p);
  if (!t) return null;
  try { return JSON.parse(t); } catch { return null; }
}

async function readAuditLog(home) {
  const p = path.join(home, '.config', 'opencode', 'logs', 'audit.log');
  const text = await readText(p);
  if (!text) return [];
  return text.trim().split('\n').filter(Boolean).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

function combinedOutput(r) { return r.stdout + r.stderr; }

/** 单测包装器 */
function test(name, fn) {
  return async () => {
    stats.total++;
    try {
      const result = await fn();
      if (result === 'BUG') {
        stats.bug++;
        console.log(`  \x1b[33m[BUG]\x1b[0m   ${name}  (已知 bug，待 CLI 修复)`);
      } else if (result === 'SKIP') {
        stats.skip++;
        console.log(`  \x1b[90m[SKIP]\x1b[0m  ${name}`);
      } else {
        stats.pass++;
        console.log(`  \x1b[32m[PASS]\x1b[0m ${name}`);
      }
    } catch (e) {
      stats.fail++;
      const msg = e && e.message ? e.message : String(e);
      failures.push({ name, error: msg });
      console.log(`  \x1b[31m[FAIL]\x1b[0m ${name}`);
      console.log(`         ${msg}`);
    }
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertContains(haystack, needle, label) {
  if (!haystack || !haystack.includes(needle)) {
    const preview = (haystack || '').slice(0, 200).replace(/\n/g, '\\n');
    throw new Error(`${label}: ${JSON.stringify(needle)} not found in: ${preview}`);
  }
}

function assertJsonShape(stdout) {
  try {
    return JSON.parse(stdout.trim());
  } catch (e) {
    throw new Error(`stdout is not valid JSON: ${e.message}; head: ${stdout.slice(0, 120)}`);
  }
}

// ============================================================
// 初始化：建临时 HOME + 写入最小可用的 opencode.json
// ============================================================
async function setupHome() {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'occ-test-'));
  const configDir = path.join(home, '.config', 'opencode');
  await fs.mkdir(configDir, { recursive: true });

  const initialConfig = {
    $schema: 'https://opencode.ai/config.json',
    model: 'opencode/deepseek-v4-flash-free',
    provider: {},
  };
  await fs.writeFile(
    path.join(configDir, 'opencode.json'),
    JSON.stringify(initialConfig, null, 2) + '\n',
    'utf-8'
  );
  return home;
}

async function teardownHome(home) {
  if (home && existsSync(home)) {
    await fs.rm(home, { recursive: true, force: true });
  }
}

// ============================================================
// 用例分组
// ============================================================

async function groupTemplate(home) {
  console.log('\n-- template --');
  const cfgDir = path.join(home, '.config', 'opencode');
  const tplDir = path.join(cfgDir, 'templates');

  await test('template save --dry-run 不创建 templates 目录', async () => {
    const r = runCli(['template', 'save', 't1'], { home, dryRun: true });
    assertEq(r.code, 0, 'exit code');
    assertContains(r.stdout, 'DRY-RUN', '应有 DRY-RUN 标记');
    assert(!(await pathExists(tplDir)), 'templates 目录被意外创建');
  })();

  await test('template save --dry-run --json 输出结构化预览', async () => {
    const r = runCli(['template', 'save', 't1'], { home, dryRun: true, json: true });
    assertEq(r.code, 0, 'exit code');
    const obj = assertJsonShape(r.stdout);
    assertEq(obj.action, 'template.save', 'action');
    assertEq(obj.name, 't1', 'name');
    assertEq(obj.exists, false, 'exists');
    assertEq(obj.wouldCreateDir, true, 'wouldCreateDir');
    assert(Array.isArray(obj.keys), 'keys 应是数组');
    assert(typeof obj.size === 'number' && obj.size > 0, 'size 应是正数');
  })();

  await test('template save 真实写入文件 + audit', async () => {
    const r = runCli(['template', 'save', 't1'], { home });
    assertEq(r.code, 0, 'exit code');
    assert(await pathExists(path.join(tplDir, 't1.json')), 't1.json 未创建');
    const audit = await readAuditLog(home);
    const entry = audit.find((a) => a.action === 'template.save' && a.detail.name === 't1');
    assert(entry, 'audit 中未找到 template.save t1');
    assertEq(entry.detail.overwrite, false, 'overwrite 应为 false');
  })();

  await test('template save 第二次写入应标记 overwrite=true', async () => {
    runCli(['template', 'save', 't1'], { home });
    const audit = await readAuditLog(home);
    const saves = audit.filter((a) => a.action === 'template.save' && a.detail.name === 't1');
    assert(saves.length >= 2, `应有 ≥2 条 template.save 记录，实际 ${saves.length}`);
    assertEq(saves[saves.length - 1].detail.overwrite, true, '最近一次应为 overwrite');
  })();

  await test('template save 拒绝非法名字（包含 /）', async () => {
    const r = runCli(['template', 'save', '../bad'], { home });
    assertEq(r.code, 0, 'exit code');
    assertContains(combinedOutput(r), '非法模板名', '错误提示');
    assert(!(await pathExists(path.join(tplDir, '../bad.json'))), '非法名字不应创建文件');
  })();

  await test('template delete --dry-run 不删文件', async () => {
    const r = runCli(['template', 'delete', 't1'], { home, dryRun: true });
    assertEq(r.code, 0, 'exit code');
    assert(await pathExists(path.join(tplDir, 't1.json')), 't1.json 被意外删除');
  })();

  await test('template delete --yes 真实删除 + audit', async () => {
    const r = runCli(['template', 'delete', 't1'], { home, yes: true });
    assertEq(r.code, 0, 'exit code');
    assert(!(await pathExists(path.join(tplDir, 't1.json'))), 't1.json 未被删除');
    const audit = await readAuditLog(home);
    assert(audit.some((a) => a.action === 'template.delete' && a.detail.name === 't1'), 'audit 缺 template.delete');
  })();
}

async function groupProfile(home) {
  console.log('\n-- profile --');
  const cfgDir = path.join(home, '.config', 'opencode');
  const profDir = path.join(cfgDir, 'profiles');
  const activePath = path.join(cfgDir, '.active-profile');

  await test('profile save --dry-run 不创建 profiles 目录', async () => {
    const r = runCli(['profile', 'save', 'p1'], { home, dryRun: true });
    assertEq(r.code, 0, 'exit code');
    assert(!(await pathExists(profDir)), 'profiles 目录被意外创建');
    assert(!(await pathExists(activePath)), '.active-profile 被意外创建');
  })();

  await test('profile save 真实写入文件 + audit', async () => {
    const r = runCli(['profile', 'save', 'p1'], { home });
    assertEq(r.code, 0, 'exit code');
    assert(await pathExists(path.join(profDir, 'p1.json')), 'p1.json 未创建');
    const audit = await readAuditLog(home);
    assert(audit.some((a) => a.action === 'profile.save' && a.detail.name === 'p1'), 'audit 缺 profile.save');
  })();

  await test('profile use --dry-run --json 输出预览且不改盘', async () => {
    const before = await readJSONSafe(path.join(cfgDir, 'opencode.json'));
    const r = runCli(['profile', 'use', 'p1'], { home, dryRun: true, json: true });
    assertEq(r.code, 0, 'exit code');
    const obj = assertJsonShape(r.stdout);
    assertEq(obj.action, 'profile.use', 'action');
    assertEq(obj.name, 'p1', 'name');
    const after = await readJSONSafe(path.join(cfgDir, 'opencode.json'));
    assertEq(JSON.stringify(before), JSON.stringify(after), 'opencode.json 不应被改动');
  })();

  await test('profile use --yes 真实切换并写 .active-profile', async () => {
    const r = runCli(['profile', 'use', 'p1'], { home, yes: true });
    assertEq(r.code, 0, 'exit code');
    assert(await pathExists(activePath), '.active-profile 未创建');
    const active = await readJSONSafe(activePath);
    assert(active && active.name === 'p1', `active.name 应为 p1，实际: ${JSON.stringify(active)}`);
  })();

  await test('profile delete --dry-run 正确标记激活态', async () => {
    const r = runCli(['profile', 'delete', 'p1'], { home, dryRun: true, json: true });
    assertEq(r.code, 0, 'exit code');
    const obj = assertJsonShape(r.stdout);
    assertEq(obj.action, 'profile.delete', 'action');
    assertEq(obj.isActive, true, 'isActive 应为 true（当前是激活 profile）');
    assert(await pathExists(path.join(profDir, 'p1.json')), 'profile 文件被意外删除');
    assert(await pathExists(activePath), '.active-profile 被意外删除');
  })();

  await test('profile delete --yes 联动清掉 .active-profile + audit', async () => {
    const r = runCli(['profile', 'delete', 'p1'], { home, yes: true });
    assertEq(r.code, 0, 'exit code');
    assert(!(await pathExists(path.join(profDir, 'p1.json'))), 'profile 文件未被删除');
    assert(!(await pathExists(activePath)), '.active-profile 未被联动清理');
    const audit = await readAuditLog(home);
    assert(audit.some((a) => a.action === 'profile.delete' && a.detail.name === 'p1'), 'audit 缺 profile.delete');
  })();
}

async function groupBackup(home) {
  console.log('\n-- backup --');
  const cfgDir = path.join(home, '.config', 'opencode');
  const bkpDir = path.join(cfgDir, 'backups');

  await test('backup create 生成备份文件 + audit', async () => {
    const r = runCli(['backup', 'create'], { home });
    assertEq(r.code, 0, 'exit code');
    const files = await fs.readdir(bkpDir);
    assert(files.some((f) => /^opencode-.*\.json$/.test(f)), '无备份文件');
    const audit = await readAuditLog(home);
    assert(audit.some((a) => a.action === 'backup.create'), 'audit 缺 backup.create');
  })();

  await test('backup cleanup --keep 1 --dry-run 不删任何备份', async () => {
    // 建 3 个不同 mtime 的备份
    for (let i = 0; i < 3; i++) {
      runCli(['backup', 'create'], { home });
      await new Promise((res) => setTimeout(res, 1100));
    }
    const before = (await fs.readdir(bkpDir)).length;
    assert(before >= 3, `应至少有 3 个备份，实际 ${before}`);
    const r = runCli(['backup', 'cleanup', '--keep', '1'], { home, dryRun: true });
    assertEq(r.code, 0, 'exit code');
    const after = (await fs.readdir(bkpDir)).length;
    assertEq(after, before, 'dry-run 不应删除任何文件');
  })();

  await test('backup cleanup --keep 1 --yes 保留最新 1 个', async () => {
    const before = (await fs.readdir(bkpDir)).length;
    const r = runCli(['backup', 'cleanup', '--keep', '1'], { home, yes: true });
    assertEq(r.code, 0, 'exit code');
    const after = (await fs.readdir(bkpDir)).length;
    assertEq(after, 1, `期望保留 1 个，实际 ${after}`);
    assert(after < before, `清理后应比 ${before} 少`);
  })();

  await test('backup watch --once --dry-run 快速退出（< 10s）', async () => {
    const t0 = Date.now();
    const r = runCli(['backup', 'watch', '--once', '--interval', '5s'],
      { home, dryRun: true, timeoutMs: 15000 });
    const dt = Date.now() - t0;
    assertEq(r.code, 0, 'exit code');
    assert(!r.timedOut, '进程超时（说明 --once 没生效）');
    assert(dt < 10000, `退出耗时 ${dt}ms 过长`);
  })();
}

async function groupKey(home) {
  console.log('\n-- key --');
  const cfgDir = path.join(home, '.config', 'opencode');
  const keyPath = path.join(cfgDir, '.keys.json');

  await test('key list --json 空时返回 {}', async () => {
    const r = runCli(['key', 'list'], { home, json: true });
    assertEq(r.code, 0, 'exit code');
    const obj = assertJsonShape(r.stdout);
    assert(obj && typeof obj === 'object' && Object.keys(obj).length === 0, `期望空对象，实际: ${r.stdout}`);
  })();

  await test('key set 通过 stdin 喂值真实写入 + audit', async () => {
    // cmdKey set 用 promptInput 读取 stdin（设计选择：避免 shell 历史泄露）
    const r = runCli(['key', 'set', 'opencode'],
      { home, input: 'sk-test-realkey-12345678\n', timeoutMs: 10000 });
    assertEq(r.code, 0, 'exit code');
    assert(await pathExists(keyPath), 'key store 未创建');
    const store = await readJSONSafe(keyPath);
    assert(store && store.opencode === 'sk-test-realkey-12345678', `key 值不对: ${JSON.stringify(store)}`);
    const audit = await readAuditLog(home);
    assert(audit.some((a) => a.action === 'key.set' && a.detail.provider === 'opencode'), 'audit 缺 key.set');
  })();

  await test('key list --json 列出已存密钥', async () => {
    const r = runCli(['key', 'list'], { home, json: true });
    assertEq(r.code, 0, 'exit code');
    const obj = assertJsonShape(r.stdout);
    assert(obj && 'opencode' in obj, `应包含 opencode 键，实际: ${r.stdout}`);
  })();

  await test('key delete --dry-run 不删（用 --yes 跳过 confirm）', async () => {
    const r = runCli(['key', 'delete', 'opencode'],
      { home, dryRun: true, yes: true, timeoutMs: 10000 });
    assertEq(r.code, 0, 'exit code');
    assertContains(r.stdout, 'DRY-RUN', '应有 DRY-RUN 标记');
    assert(await pathExists(keyPath), 'key store 被意外删除');
  })();

  await test('key delete --yes 真实删除 + audit', async () => {
    const r = runCli(['key', 'delete', 'opencode'], { home, yes: true });
    assertEq(r.code, 0, 'exit code');
    const store = await readJSONSafe(keyPath);
    assert(store && typeof store === 'object', 'key store 读取失败');
    assert(!('opencode' in store), 'key store 里仍残留 opencode');
    const audit = await readAuditLog(home);
    assert(audit.some((a) => a.action === 'key.delete' && a.detail.provider === 'opencode'), 'audit 缺 key.delete');
  })();
}

async function groupAgent(home) {
  console.log('\n-- agent --');
  const cfgDir = path.join(home, '.config', 'opencode');
  const agDir = path.join(cfgDir, 'agents');
  const cfgPath = path.join(cfgDir, 'opencode.json');

  await test('agent create 写入 config + .md + audit', async () => {
    const r = runCli(['agent', 'create', 'a1', 'desc-test'], { home });
    assertEq(r.code, 0, 'exit code');
    const cfg = await readJSONSafe(cfgPath);
    assert(cfg.agent && cfg.agent.a1, 'config.agent.a1 未创建');
    assertEq(cfg.agent.a1.mode, 'primary', '默认 mode');
    assert(await pathExists(path.join(agDir, 'a1.md')), '.md 文件未创建');
    const audit = await readAuditLog(home);
    const e = audit.find((a) => a.action === 'agent.create' && a.detail.name === 'a1');
    assert(e, 'audit 缺 agent.create a1');
    assertEq(e.detail.mode, 'primary', 'audit.detail.mode');
  })();

  await test('agent delete 真实删除 config + .md + audit', async () => {
    const r = runCli(['agent', 'delete', 'a1', '--yes'], { home });
    assertEq(r.code, 0, 'exit code');
    const cfg = await readJSONSafe(cfgPath);
    assert(!cfg.agent || !cfg.agent.a1, 'config.agent.a1 未删除');
    assert(!(await pathExists(path.join(agDir, 'a1.md'))), '.md 未删除');
    const audit = await readAuditLog(home);
    assert(audit.some((a) => a.action === 'agent.delete' && a.detail.name === 'a1'), 'audit 缺 agent.delete');
  })();

  await test('agent delete --dry-run 不删 .md', async () => {
    // 准备：先建一个 agent
    runCli(['agent', 'create', 'bug-probe', 'probe'], { home });
    const mdPath = path.join(agDir, 'bug-probe.md');
    assert(await pathExists(mdPath), '前置：.md 应存在');
    // dry-run delete
    const r = runCli(['agent', 'delete', 'bug-probe'], { home, dryRun: true });
    assertEq(r.code, 0, 'exit code');
    assert(await pathExists(mdPath), '.md 被意外删除');
    const cfg = await readJSONSafe(cfgPath);
    assert(cfg.agent && cfg.agent['bug-probe'], 'config.agent.bug-probe 不应被删除');
  })();
}

async function groupProvider(home) {
  console.log('\n-- provider --');
  const cfgDir = path.join(home, '.config', 'opencode');
  const cfgPath = path.join(cfgDir, 'opencode.json');

  await test('add provider --dry-run 不写 config', async () => {
    const before = await readText(cfgPath);
    const r = runCli(['add', 'provider', 'fake', 'https://api.fake.example.com/v1', 'sk-fake'],
      { home, dryRun: true });
    assertEq(r.code, 0, 'exit code');
    const after = await readText(cfgPath);
    assertEq(before, after, 'opencode.json 不应被改动');
  })();

  await test('add provider 真实写入 + audit', async () => {
    const r = runCli(['add', 'provider', 'https://fake.example.com/v1', 'sk-fake-key'],
      { home });
    assertEq(r.code, 0, 'exit code');
    const cfg = await readJSONSafe(cfgPath);
    assert(cfg.provider && cfg.provider.fake, 'config.provider.fake 未创建');
    const audit = await readAuditLog(home);
    assert(audit.some((a) => a.action === 'provider.add' && a.detail.name === 'fake'), 'audit 缺 provider.add');
  })();

  await test('remove provider --dry-run 不删且保留配置', async () => {
    const r = runCli(['remove', 'provider', 'fake'], { home, dryRun: true, yes: true });
    assertEq(r.code, 0, 'exit code');
    const cfg = await readJSONSafe(cfgPath);
    assert(cfg.provider && cfg.provider.fake, 'fake 应仍在（writeJSON 短路）');
  })();

  await test('remove provider --yes 真实删除 + audit', async () => {
    const r = runCli(['remove', 'provider', 'fake'], { home, yes: true });
    assertEq(r.code, 0, 'exit code');
    const cfg = await readJSONSafe(cfgPath);
    assert(!cfg.provider || !cfg.provider.fake, 'provider.fake 未删除');
    const audit = await readAuditLog(home);
    assert(audit.some((a) => a.action === 'provider.remove' && a.detail.name === 'fake'), 'audit 缺 provider.remove');
  })();
}

async function groupSetAndJson(home) {
  console.log('\n-- set / json --');
  const cfgDir = path.join(home, '.config', 'opencode');
  const cfgPath = path.join(cfgDir, 'opencode.json');

  await test('set small_model --dry-run 不改 small_model', async () => {
    const before = await readJSONSafe(cfgPath);
    const r = runCli(['set', 'small_model', 'opencode/big-pickle'], { home, dryRun: true });
    assertEq(r.code, 0, 'exit code');
    const after = await readJSONSafe(cfgPath);
    assertEq(after.small_model, before.small_model, 'small_model 不应被改动');
  })();

  await test('set small_model 真实写入 + audit', async () => {
    const r = runCli(['set', 'small_model', 'opencode/big-pickle'], { home });
    assertEq(r.code, 0, 'exit code');
    const cfg = await readJSONSafe(cfgPath);
    assertEq(cfg.small_model, 'opencode/big-pickle', 'small_model');
    const audit = await readAuditLog(home);
    assert(audit.some((a) => a.action === 'config.set' && a.detail.key === 'small_model'), 'audit 缺 config.set');
  })();

  await test('json set --dry-run 不写', async () => {
    const before = await readJSONSafe(cfgPath);
    const r = runCli(['json', 'set', 'provider.test', '{"x":1}'], { home, dryRun: true });
    assertEq(r.code, 0, 'exit code');
    const after = await readJSONSafe(cfgPath);
    assert(!after.provider || !after.provider.test, 'provider.test 被意外创建');
  })();

  await test('json set 真实写入 + audit', async () => {
    const r = runCli(['json', 'set', 'provider.test', '{"x":1}'], { home });
    assertEq(r.code, 0, 'exit code');
    const cfg = await readJSONSafe(cfgPath);
    assert(cfg.provider && cfg.provider.test && cfg.provider.test.x === 1, 'json.set 未生效');
    const audit = await readAuditLog(home);
    assert(audit.some((a) => a.action === 'json.set' && a.detail.path === 'provider.test'), 'audit 缺 json.set');
  })();

  await test('json patch --dry-run 不写', async () => {
    const before = await readJSONSafe(cfgPath);
    const r = runCli(['json', 'patch', 'provider.test', '{"op":"replace","value":{"x":2}}'],
      { home, dryRun: true });
    assertEq(r.code, 0, 'exit code');
    const after = await readJSONSafe(cfgPath);
    assertEq(after.provider.test.x, 1, 'provider.test.x 不应被改动');
  })();

  await test('json patch 真实写入 + audit', async () => {
    const r = runCli(['json', 'patch', 'provider.test', '{"op":"replace","value":{"x":2}}'],
      { home });
    assertEq(r.code, 0, 'exit code');
    const cfg = await readJSONSafe(cfgPath);
    assertEq(cfg.provider.test.x, 2, 'json.patch 未生效');
  })();
}

async function groupExportImport(home) {
  console.log('\n-- export / import --');

  await test('export 写出文件', async () => {
    const out = path.join(home, 'exported.json');
    const r = runCli(['export', out], { home });
    assertEq(r.code, 0, 'exit code');
    const text = await readText(out);
    assert(text, '导出文件为空');
    JSON.parse(text); // 应当是合法 JSON
  })();

  await test('export --redact 脱敏 apiKey', async () => {
    // 先写入一个带 apiKey 的 provider
    runCli(['add', 'provider', 'https://sec.example.com/v1', 'sk-verylong-secret-key-12345'], { home });
    const out = path.join(home, 'redacted.json');
    const r = runCli(['export', out, '--redact'], { home });
    assertEq(r.code, 0, 'exit code');
    const text = await readText(out);
    assert(text, '导出文件为空');
    assert(!text.includes('sk-verylong-secret-key-12345'), 'apiKey 未脱敏');
    assert(text.includes('***'), '应包含 *** 占位符');
  })();

  await test('import --dry-run 不覆盖 config', async () => {
    const src = path.join(home, 'to-import.json');
    await fs.writeFile(src,
      JSON.stringify({ model: 'opencode/north-mini-code-free', provider: { foo: { baseURL: 'http://x' } } }),
      'utf-8');
    const cfgPath = path.join(home, '.config', 'opencode', 'opencode.json');
    const before = await readJSONSafe(cfgPath);
    const r = runCli(['import', src], { home, dryRun: true });
    assertEq(r.code, 0, 'exit code');
    const after = await readJSONSafe(cfgPath);
    assertEq(after.model, before.model, 'model 不应被改动');
    assert(!after.provider || !after.provider.foo, 'provider.foo 不应被创建');
  })();
}

async function groupHelpAndErrors(home) {
  console.log('\n-- help / errors --');

  await test('help 显示用法且退出 0', async () => {
    const r = runCli(['help'], { home, timeoutMs: 5000 });
    assertEq(r.code, 0, 'exit code');
    assertContains(combinedOutput(r), '用法', 'help 应包含"用法"');
    assertContains(combinedOutput(r), 'template', 'help 应列出 template 命令');
  })();

  await test('未知命令退出码非 0', async () => {
    const r = runCli(['definitely-not-a-command'], { home, timeoutMs: 5000 });
    assert(r.code !== 0, `期望非 0 退出码，实际 ${r.code}`);
  })();

  await test('doctor 运行不崩溃（有诊断输出即可）', async () => {
    const r = runCli(['doctor'], { home, timeoutMs: 15000 });
    // doctor 发现问题时会退出 1，这是正常行为
    assert(r.code === 0 || r.code === 1, `期望 0 或 1，实际 ${r.code}`);
    const text = combinedOutput(r);
    assert(text.length > 50, 'doctor 应有诊断输出');
  })();

  await test('status 正常显示概览', async () => {
    const r = runCli(['status'], { home, timeoutMs: 5000 });
    assertEq(r.code, 0, 'exit code');
    assertContains(r.stdout, '配置概览', 'status 应显示配置概览');
  })();
}

async function groupAuditLog(home) {
  console.log('\n-- audit log 综合 --');

  await test('所有 audit 记录均含合法 time / action / detail', async () => {
    const audit = await readAuditLog(home);
    assert(audit.length > 0, '审计日志为空');
    for (const e of audit) {
      assert(typeof e.time === 'string' && e.time.length > 0, `缺 time: ${JSON.stringify(e)}`);
      assert(typeof e.action === 'string' && /^[a-zA-Z.]+$/.test(e.action), `非法 action: ${e.action}`);
      assert(typeof e.detail === 'object' && e.detail !== null, `缺 detail: ${JSON.stringify(e)}`);
    }
  })();

  await test('dry-run 模式不写 audit log', async () => {
    const before = (await readAuditLog(home)).length;
    runCli(['template', 'save', 'audit-probe-1'], { home, dryRun: true });
    runCli(['profile',   'save', 'audit-probe-2'], { home, dryRun: true });
    runCli(['json',      'set',  'audit.probe', '"x"'], { home, dryRun: true });
    const after = (await readAuditLog(home)).length;
    assertEq(after, before, 'dry-run 不应增加 audit 记录');
  })();

  await test('log tail --json 返回最近 N 条', async () => {
    const r = runCli(['log', 'tail', '5'], { home, json: true });
    assertEq(r.code, 0, 'exit code');
    const arr = assertJsonShape(r.stdout);
    assert(Array.isArray(arr), '应返回数组');
    assert(arr.length <= 5, `应 ≤5 条，实际 ${arr.length}`);
  })();
}

// ============================================================
// 主流程
// ============================================================
async function main() {
  // 前置：语法检查
  const syntaxCheck = spawnSync(process.execPath, ['--check', CLI_PATH], { encoding: 'utf-8' });
  if (syntaxCheck.status !== 0) {
    console.error(`\x1b[31m[ERROR]\x1b[0m CLI 语法检查失败:\n${syntaxCheck.stderr}`);
    process.exit(2);
  }

  console.log(`\n========================================`);
  console.log(`  occ (opencode-config) 回归测试`);
  console.log(`========================================`);
  console.log(`CLI:     ${CLI_PATH}`);
  console.log(`平台:    ${process.platform} ${process.arch}`);
  console.log(`Node:    ${process.version}`);

  const home = await setupHome();
  console.log(`测试 HOME: ${home}`);

  try {
    await groupTemplate(home);
    await groupProfile(home);
    await groupBackup(home);
    await groupKey(home);
    await groupAgent(home);
    await groupProvider(home);
    await groupSetAndJson(home);
    await groupExportImport(home);
    await groupHelpAndErrors(home);
    await groupAuditLog(home);
  } finally {
    await teardownHome(home);
  }

  console.log(`\n========================================`);
  console.log(`  结果汇总`);
  console.log(`========================================`);
  console.log(`  总数:   ${stats.total}`);
  console.log(`  \x1b[32m通过:   ${stats.pass}\x1b[0m`);
  console.log(`  \x1b[31m失败:   ${stats.fail}\x1b[0m`);
  console.log(`  \x1b[33m已知 bug: ${stats.bug}\x1b[0m  (待 CLI 修复)`);
  console.log(`  跳过:   ${stats.skip}`);

  if (stats.fail > 0) {
    console.log(`\n  失败明细:`);
    for (const f of failures) {
      console.log(`    - ${f.name}`);
      console.log(`      ${f.error}`);
    }
    process.exit(1);
  }

  console.log(`\n  ✓ 无回归（已知 bug 已标记，不影响通过）\n`);
  process.exit(0);
}

main().catch((e) => {
  console.error(`\n\x1b[31m[ERROR]\x1b[0m 测试脚本自身异常:`, e);
  process.exit(2);
});
