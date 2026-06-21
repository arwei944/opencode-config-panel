/**
 * AgentService 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { AgentService } from '../../core/services/AgentService';
import { MockConfigPort } from '../mocks/MockConfigPort';
import { MockFileSystemPort } from '../mocks/MockFileSystemPort';

const AGENTS_DIR = path.join(os.homedir(), '.config', 'opencode', 'agents');

describe('AgentService', () => {
  let configPort: MockConfigPort;
  let fsPort: MockFileSystemPort;
  let service: AgentService;

  beforeEach(() => {
    configPort = new MockConfigPort({
      agent: {
        'test-agent': { mode: 'primary', description: '测试代理' },
      },
    });
    fsPort = new MockFileSystemPort();
    // 预先创建 agents 目录和 agent .md 文件
    fsPort.setFile(path.join(AGENTS_DIR, 'test-agent.md'), '---\nname: test-agent\nmode: primary\ndescription: 测试代理\n---\n\n# Test Agent');
    service = new AgentService({
      configPort,
      fileSystemPort: fsPort,
      agentsDir: AGENTS_DIR,
      getAgentFilePath: (name: string) => path.join(AGENTS_DIR, `${name}.md`),
    });
  });

  it('应列出所有代理', async () => {
    const agents = await service.list();
    const names = agents.map(a => a.name);
    expect(names).toContain('test-agent');
  });

  it('应创建新代理', async () => {
    const result = await service.create('new-agent', { mode: 'subagent', description: '新代理' });
    expect(result.name).toBe('new-agent');
    expect(result.config.mode).toBe('subagent');
    const agents = await service.list();
    const names = agents.map(a => a.name);
    expect(names).toContain('new-agent');
  });

  it('应拒绝重复代理', async () => {
    await expect(service.create('test-agent', { mode: 'subagent' })).rejects.toThrow('已存在');
  });

  it('应更新代理', async () => {
    await service.update('test-agent', { description: '更新描述' });
    const agents = await service.list();
    const agent = agents.find(a => a.name === 'test-agent');
    expect(agent!.config.description).toBe('更新描述');
  });

  it('应拒绝更新不存在的代理', async () => {
    await expect(service.update('nonexistent', {})).rejects.toThrow('不存在');
  });

  it('应删除代理', async () => {
    await service.delete('test-agent');
    const agents = await service.list();
    const names = agents.map(a => a.name);
    expect(names).not.toContain('test-agent');
  });

  it('应拒绝删除不存在的代理', async () => {
    await expect(service.delete('nonexistent')).rejects.toThrow('不存在');
  });
});
