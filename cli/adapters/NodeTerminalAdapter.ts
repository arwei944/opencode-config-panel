/**
 * ============================================================
 * 适配器：NodeTerminalAdapter
 * 描述：终端输出的 Node.js 实现
 * 实现：ITerminalPort
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

  out(...args: unknown[]): void {
    if (!this.quietMode) console.log(...args);
  }

  ok(msg: string): void {
    if (this.quietMode) return;
    console.log(this.colorMode ? Colors.green(`✓ ${msg}`) : `✓ ${msg}`);
  }

  info(msg: string): void {
    if (this.quietMode) return;
    console.log(this.colorMode ? Colors.dim(msg) : msg);
  }

  warn(msg: string): void {
    if (this.quietMode) return;
    console.log(this.colorMode ? Colors.yellow(`⚠ ${msg}`) : `⚠ ${msg}`);
  }

  err(msg: string): void {
    // 错误不受 --quiet 影响
    console.error(this.colorMode ? Colors.red(`✗ ${msg}`) : `✗ ${msg}`);
  }

  jsonOut(data: unknown): void {
    if (this.jsonMode) {
      if (typeof data === 'string') console.log(data);
      else console.log(JSON.stringify(data));
    }
  }

  raw(...args: unknown[]): void {
    console.log(...args);
  }
}
