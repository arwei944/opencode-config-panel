/**
 * ToolService 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolService } from '../../core/services/ToolService';
import { MockConfigPort } from '../mocks/MockConfigPort';

describe('ToolService', () => {
  let configPort: MockConfigPort;
  let service: ToolService;

  beforeEach(() => {
    configPort = new MockConfigPort({ tools: { read: true, edit: false } });
    service = new ToolService({ configPort });
  });

  it('应获取工具列表', async () => {
    const result = await service.list();
    expect(result.tools).toBeDefined();
    expect(result.globalToolSettings).toBeDefined();
  });

  it('应更新全局工具设置', async () => {
    await service.updateGlobal({ read: false, edit: true, bash: true });
    const config = await configPort.read();
    expect(config.tools).toEqual({ read: false, edit: true, bash: true });
  });

  it('应更新主代理工具', async () => {
    await service.updatePrimaryTools(['read', 'edit', 'bash']);
    const config = await configPort.read();
    expect(config.experimental).toHaveProperty('primary_tools');
    expect((config.experimental as { primary_tools: string[] }).primary_tools).toEqual(['read', 'edit', 'bash']);
  });

  it('应重置代理覆盖', async () => {
    // 需要先在配置中存在该代理
    configPort.setData({
      agent: { 'test-agent': { mode: 'primary' } },
      tools: { read: true },
    });
    await service.resetAgentOverrides('test-agent');
    // 不应报错
  });
});
