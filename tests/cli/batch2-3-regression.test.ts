/**
 * Batch 2-3 CLI 命令回归测试（简化版）
 * 覆盖：--json / --dry-run 基础验证
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const CLI_PATH = path.join(process.cwd(), 'scripts', 'occ.mjs');

// 临时 HOME 隔离
let tempHome: string;

async function runCli(args: string[], opts: { dryRun?: boolean; yes?: boolean; json?: boolean } = {}) {
  const fullArgs = [CLI_PATH, '--no-color'];
  if (opts.dryRun) fullArgs.push('--dry-run');
  if (opts.yes) fullArgs.push('--yes');
  if (opts.json) fullArgs.push('--json');
  fullArgs.push(...args);

  const r = spawnSync('node', fullArgs, {
    env: { ...process.env, HOME: tempHome },
    encoding: 'utf-8',
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

beforeEach(async () => {
  tempHome = path.join(os.tmpdir(), `occ-test-${Date.now()}`);
  await fs.mkdir(tempHome, { recursive: true });
  await fs.mkdir(path.join(tempHome, '.config', 'opencode'), { recursive: true });
});

afterEach(async () => {
  try { await fs.rm(tempHome, { recursive: true, force: true }); } catch { /* ignore */ }
});

// ============================================================
// 高级设置：compaction / tool-output / experimental / attachment
// ============================================================
describe('高级设置 --json 支持', () => {
  it('compaction show --json', async () => {
    const r = await runCli(['compaction', 'show', '--json']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"action":"compaction.show"');
  });

  it('compaction set --dry-run --json', async () => {
    const r = await runCli(['compaction', 'set', '--auto', '--dry-run', '--json']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"dryRun":true');
  });

  it('tool-output show --json', async () => {
    const r = await runCli(['tool-output', 'show', '--json']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"action":"tool-output.show"');
  });

  it('tool-output set --dry-run --json', async () => {
    const r = await runCli(['tool-output', 'set', '--max-lines', '100', '--dry-run', '--json']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"dryRun":true');
  });

  it('experimental list --json', async () => {
    const r = await runCli(['experimental', 'list', '--json']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"action":"experimental.list"');
  });

  it('experimental set --dry-run --json', async () => {
    const r = await runCli(['experimental', 'set', 'test_feature', 'true', '--dry-run', '--json']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"dryRun":true');
  });

  it('attachment show --json', async () => {
    const r = await runCli(['attachment', 'show', '--json']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"action":"attachment.show"');
  });

  it('attachment set --dry-run --json', async () => {
    const r = await runCli(['attachment', 'set', 'max-width', '800', '--dry-run', '--json']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"dryRun":true');
  });
});

// ============================================================
// provider --json 补全
// ============================================================
describe('provider --json 支持', () => {
  it('provider list-models --json（无 provider 时）', async () => {
    const r = await runCli(['provider', 'list-models', 'nonexistent', '--json']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"action":"provider.list-models"');
  });

  it('provider estimate --json（无 provider 时）', async () => {
    const r = await runCli(['provider', 'estimate', 'nonexistent', '--json']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"action":"provider.estimate"');
  });

  it('provider doctor --json', async () => {
    const r = await runCli(['provider', 'doctor', '--json']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"action":"provider.doctor"');
  });
});

// ============================================================
// reference --json / --dry-run
// ============================================================
describe('reference --json / --dry-run', () => {
  const refName = `test-ref-${Date.now()}`;

  it('reference add --dry-run', async () => {
    const r = await runCli(['reference', 'add', refName, '/tmp/test', '--dry-run']);
    expect(r.code).toBe(0);
    expect(r.stdout + r.stderr).toContain('[DRY-RUN]');
  });

  it('reference add --json', async () => {
    const r = await runCli(['reference', 'add', refName, '/tmp/test', '--json']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"action":"reference.add"');
  });

  it('reference remove --dry-run', async () => {
    // 先添加一个引用
    await runCli(['reference', 'add', refName, '/tmp/test']);
    const r = await runCli(['reference', 'remove', refName, '--dry-run']);
    expect(r.code).toBe(0);
    expect(r.stdout + r.stderr).toContain('[DRY-RUN]');
  });
});

// ============================================================
// command --json / --dry-run
// ============================================================
describe('command --json / --dry-run', () => {
  const cmdName = `test-cmd-${Date.now()}`;

  it('command add --dry-run', async () => {
    const r = await runCli(['command', 'add', cmdName, '--template', 'echo hello', '--dry-run']);
    expect(r.code).toBe(0);
    expect(r.stdout + r.stderr).toContain('[DRY-RUN]');
  });

  it('command add --json', async () => {
    const r = await runCli(['command', 'add', cmdName, '--template', 'echo hello', '--json']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"action":"command.add"');
  });

  it('command remove --dry-run', async () => {
    await runCli(['command', 'add', cmdName, '--template', 'echo hello']);
    const r = await runCli(['command', 'remove', cmdName, '--dry-run']);
    expect(r.code).toBe(0);
    expect(r.stdout + r.stderr).toContain('[DRY-RUN]');
  });
});

// ============================================================
// server --json / --dry-run
// ============================================================
describe('server --json / --dry-run', () => {
  it('server set --dry-run --json', async () => {
    const r = await runCli(['server', 'set', '--port', '3456', '--dry-run', '--json']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"dryRun":true');
    expect(r.stdout).toContain('"action":"server.set"');
  });

  it('server set --json', async () => {
    const r = await runCli(['server', 'set', '--port', '3456', '--json']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"action":"server.set"');
  });
});

// ============================================================
// backup cleanup 时间格式
// ============================================================
describe('backup cleanup 时间格式', () => {
  it('backup cleanup --keep 5d --dry-run --json', async () => {
    const r = await runCli(['backup', 'cleanup', '--keep', '5d', '--dry-run', '--json']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"action":"backup.cleanup"');
  });

  it('backup cleanup --keep 12h --dry-run --json', async () => {
    const r = await runCli(['backup', 'cleanup', '--keep', '12h', '--dry-run', '--json']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"action":"backup.cleanup"');
  });
});

// ============================================================
// diff --json
// ============================================================
describe('diff --json', () => {
  it('diff import --json', async () => {
    const exportPath = path.join(tempHome, 'export.json');
    await runCli(['export', exportPath]);
    const r = await runCli(['diff', 'import', exportPath, '--json']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"action":"diff.import"');
  });
});

// ============================================================
// rollback --dry-run --json
// ============================================================
describe('rollback --dry-run --json', () => {
  it('rollback --latest --dry-run --json', async () => {
    await runCli(['backup', 'create'], { yes: true });
    const r = await runCli(['rollback', '--latest', '--dry-run', '--json']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"dryRun":true');
  });
});
