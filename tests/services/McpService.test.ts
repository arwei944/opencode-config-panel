/**
 * McpService 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { McpService } from '../../core/services/McpService';
import { MockConfigPort } from '../mocks/MockConfigPort';

describe('McpService', () => {
  let configPort: MockConfigPort;
  let service: McpService;

  beforeEach(() => {
    configPort = new MockConfigPort({
      mcp: {
        'local-server': { type: 'local' as const, command: ['node', 'server.js'] },
      },
    });
    service = new McpService({ configPort });
  });

  it('应列出所有 MCP 服务器', async () => {
    const servers = await service.list();
    expect(Object.keys(servers)).toContain('local-server');
  });

  it('应添加 MCP 服务器', async () => {
    await service.add('remote-api', { type: 'remote', url: 'https://api.example.com/mcp' });
    const servers = await service.list();
    expect(Object.keys(servers)).toContain('remote-api');
  });

  it('应更新 MCP 服务器', async () => {
    await service.update('local-server', { type: 'local', command: ['node', 'new-server.js'] });
    const servers = await service.list();
    const server = servers['local-server'];
    expect(server.command).toEqual(['node', 'new-server.js']);
  });

  it('应删除 MCP 服务器', async () => {
    await service.delete('local-server');
    const servers = await service.list();
    expect(Object.keys(servers)).not.toContain('local-server');
  });
});
