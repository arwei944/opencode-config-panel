/**
 * Mock: IConnectionTestPort
 * 用于单元测试的连接测试端口模拟实现
 */

import type { IConnectionTestPort } from '../../core/ports';
import type { DetectResult } from '../../shared/atoms';

export class MockConnectionTestPort implements IConnectionTestPort {
  private customResults: Map<string, DetectResult> = new Map();

  setResult(url: string, result: DetectResult): void {
    this.customResults.set(url, result);
  }

  async detect(baseURL: string, _apiKey?: string): Promise<DetectResult> {
    const custom = this.customResults.get(baseURL);
    if (custom) return custom;

    // 默认规则
    if (baseURL.includes('openai.com')) {
      return { name: 'openai', type: 'openai', baseURL, models: { 'gpt-4': { id: 'gpt-4', name: 'GPT-4' } } };
    }
    if (baseURL.includes('deepseek.com')) {
      return { name: 'deepseek', type: 'openai', baseURL, models: {} };
    }
    return { name: 'custom', type: 'openai', baseURL, models: {} };
  }
}
