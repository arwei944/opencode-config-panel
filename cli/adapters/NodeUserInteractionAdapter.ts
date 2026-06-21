/**
 * ============================================================
 * 适配器：NodeUserInteractionAdapter
 * 描述：用户交互的 Node.js 实现（readline）
 * 实现：IUserInteractionPort
 * ============================================================
 */

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { IUserInteractionPort } from '../ports/IUserInteractionPort';

export class NodeUserInteractionAdapter implements IUserInteractionPort {
  /** 跳过确认（--yes 模式） */
  private autoConfirm = false;

  setAutoConfirm(yes: boolean): void {
    this.autoConfirm = yes;
  }

  async confirm(query: string): Promise<boolean> {
    if (this.autoConfirm) return true;
    const rl = readline.createInterface({ input, output });
    try {
      const answer = await rl.question(query);
      return ['y', 'yes', 'Y', 'Yes', 'YES'].includes(answer.trim());
    } finally {
      rl.close();
    }
  }

  async readLine(query: string): Promise<string> {
    const rl = readline.createInterface({ input, output });
    try {
      return await rl.question(query);
    } finally {
      rl.close();
    }
  }

  async readPassword(query: string): Promise<string> {
    // 简单实现：使用 readline（不支持静默输入，可后续改进）
    const rl = readline.createInterface({ input, output });
    try {
      return await rl.question(query);
    } finally {
      rl.close();
    }
  }
}
