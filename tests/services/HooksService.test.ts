/**
 * HooksService 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HooksService } from '../../core/services/HooksService';
import { MockConfigPort } from '../mocks/MockConfigPort';

describe('HooksService', () => {
  let configPort: MockConfigPort;
  let service: HooksService;

  beforeEach(() => {
    configPort = new MockConfigPort({
      experimental: {
        hook: {
          'pre-commit': { command: 'npm test' },
          'post-merge': { command: 'npm install' },
        },
      },
    });
    service = new HooksService({ configPort });
  });

  it('应获取钩子配置', async () => {
    const hooks = await service.get();
    expect(hooks).toHaveProperty('pre-commit');
    expect(hooks).toHaveProperty('post-merge');
  });

  it('空配置应返回空对象', async () => {
    const emptyPort = new MockConfigPort({});
    const emptyService = new HooksService({ configPort: emptyPort });
    const hooks = await emptyService.get();
    expect(hooks).toEqual({});
  });

  it('应替换钩子配置', async () => {
    const result = await service.replace({
      'pre-commit': { command: 'npm run lint' },
    });
    expect(result['pre-commit'].command).toBe('npm run lint');
    const hooks = await service.get();
    expect(hooks['pre-commit'].command).toBe('npm run lint');
  });
});
