/**
 * ============================================================
 * 适配器：NodeTerminalAdapter
 * 描述：终端输出的 Node.js 实现
 * 实现：ITerminalPort
 *
 * 核心规则（--json 模式）：
 *   - stdout 只包含纯 JSON（通过 jsonOut）
 *   - 所有人类可读文本输出到 stderr
 *   - err() 始终输出到 stderr
 * ============================================================
 */

import type { ITerminalPort } from '../ports/ITerminalPort';

/** 颜色工具（简单实现，不依赖 chalk） */
const Colors = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

export class NodeTerminalAdapter implements ITerminalPort {
  private jsonMode = false;
  private quietMode = false;
  private colorMode = true;

  setOptions(opts: { json?: boolean; quiet?: boolean; color?: boolean }): void {
    if (opts.json !== undefined) this.jsonMode = opts.json;
    if (opts.quiet !== undefined) this.quietMode = opts.quiet;
    if (opts.color !== undefined) this.colorMode = opts.color;
  }

  /** 普通输出 — JSON 模式时走 stderr */
  out(...args: unknown[]): void {
    const target = this.jsonMode ? process.stderr : process.stdout;
    if (!this.jsonMode && this.quietMode) return;
    target.write(args.map(String).join(' ') + '\n');
  }

  /** 成功提示 — JSON 模式时走 stderr */
  ok(msg: string): void {
    if (this.jsonMode) {
      process.stderr.write((this.colorMode ? Colors.green(`✓ ${msg}`) : `✓ ${msg}`) + '\n');
      return;
    }
    if (this.quietMode) return;
    console.log(this.colorMode ? Colors.green(`✓ ${msg}`) : `✓ ${msg}`);
  }

  /** 信息提示 — JSON 模式时走 stderr */
  info(msg: string): void {
    if (this.jsonMode) {
      process.stderr.write((this.colorMode ? Colors.dim(msg) : msg) + '\n');
      return;
    }
    if (this.quietMode) return;
    console.log(this.colorMode ? Colors.dim(msg) : msg);
  }

  /** 警告提示 — JSON 模式时走 stderr */
  warn(msg: string): void {
    if (this.jsonMode) {
      process.stderr.write((this.colorMode ? Colors.yellow(`⚠ ${msg}`) : `⚠ ${msg}`) + '\n');
      return;
    }
    if (this.quietMode) return;
    console.log(this.colorMode ? Colors.yellow(`⚠ ${msg}`) : `⚠ ${msg}`);
  }

  /** 错误提示 — 始终走 stderr */
  err(msg: string): void {
    console.error(this.colorMode ? Colors.red(`✗ ${msg}`) : `✗ ${msg}`);
  }

  /** JSON 输出 — 始终走 stdout（--json 模式的唯一 stdout 输出方式） */
  jsonOut(data: unknown): void {
    if (typeof data === 'string') console.log(data);
    else console.log(JSON.stringify(data));
  }

  /** 原始输出 — JSON 模式时走 stderr */
  raw(...args: unknown[]): void {
    if (this.jsonMode) {
      process.stderr.write(args.map(String).join(' ') + '\n');
      return;
    }
    console.log(...args);
  }
}
