/**
 * ProviderService 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderService } from '../../core/services/ProviderService';
import { MockConfigPort } from '../mocks/MockConfigPort';
import { MockConnectionTestPort } from '../mocks/MockConnectionTestPort';

describe('ProviderService', () => {
  let configPort: MockConfigPort;
  let connectionTestPort: MockConnectionTestPort;
  let service: ProviderService;

  beforeEach(() => {
    configPort = new MockConfigPort({
      provider: {
        openai: {
          type: 'openai',
          options: { baseURL: 'https://api.openai.com', apiKey: 'sk-test' },
          models: { 'gpt-4': { id: 'gpt-4', name: 'GPT-4' } },
        },
      },
    });
    connectionTestPort = new MockConnectionTestPort();
    service = new ProviderService({ configPort, connectionTestPort });
  });

  it('应列出提供商', async () => {
    const providers = await service.list();
    expect(Object.keys(providers)).toContain('openai');
    expect(providers.openai.type).toBe('openai');
  });

  it('应获取单个提供商', async () => {
    const provider = await service.get('openai');
    expect(provider).toBeDefined();
    expect(provider!.type).toBe('openai');
  });

  it('应返回 undefined 对于不存在的提供商', async () => {
    const provider = await service.get('nonexistent');
    expect(provider).toBeUndefined();
  });

  it('应添加新提供商', async () => {
    await service.add('deepseek', {
      type: 'openai',
      options: { baseURL: 'https://api.deepseek.com', apiKey: 'sk-ds' },
    });
    const providers = await service.list();
    expect(Object.keys(providers)).toContain('deepseek');
  });

  it('应拒绝重复提供商', async () => {
    await expect(service.add('openai', { type: 'openai', options: { baseURL: 'https://test.com' } }))
      .rejects.toThrow('已存在');
  });

  it('应拒绝无效提供商名称', async () => {
    await expect(service.add('INVALID NAME!!!', { type: 'openai', options: { baseURL: 'https://test.com' } }))
      .rejects.toThrow('提供商名称必须');
  });

  it('应更新提供商', async () => {
    await service.update('openai', { type: 'openai', options: { baseURL: 'https://new.url.com', apiKey: 'sk-new' } });
    const provider = await service.get('openai');
    expect(provider!.options!.baseURL).toBe('https://new.url.com');
  });

  it('应拒绝更新不存在的提供商', async () => {
    await expect(service.update('nonexistent', { type: 'openai' })).rejects.toThrow('不存在');
  });

  it('应删除提供商', async () => {
    await service.delete('openai');
    const providers = await service.list();
    expect(Object.keys(providers)).not.toContain('openai');
  });

  it('应拒绝删除不存在的提供商', async () => {
    await expect(service.delete('nonexistent')).rejects.toThrow('不存在');
  });

  it('应智能探测提供商', async () => {
    const result = await service.detect('https://api.openai.com/v1');
    expect(result.name).toBe('openai');
    expect(result.type).toBe('openai');
  });

  it('应智能添加提供商', async () => {
    const result = await service.smartAdd('https://api.deepseek.com', 'sk-ds-key');
    expect(result.name).toBe('deepseek');
    expect(result.config.type).toBe('openai');
    // 验证已写入
    const providers = await service.list();
    expect(Object.keys(providers)).toContain('deepseek');
  });

  it('应添加模型', async () => {
    await service.addModel('openai', 'gpt-5', { id: 'gpt-5', name: 'GPT-5', context: 128000 });
    const provider = await service.get('openai');
    expect(provider!.models!['gpt-5']).toBeDefined();
    expect(provider!.models!['gpt-5'].name).toBe('GPT-5');
  });

  it('应删除模型', async () => {
    await service.deleteModel('openai', 'gpt-4');
    const provider = await service.get('openai');
    expect(provider!.models!['gpt-4']).toBeUndefined();
  });

  it('应批量更新模型', async () => {
    const models = { 'gpt-6': { id: 'gpt-6', name: 'GPT-6' } };
    await service.batchUpdateModels('openai', models);
    const provider = await service.get('openai');
    expect(Object.keys(provider!.models!)).toEqual(['gpt-6']);
  });

  it('应获取已知模型列表', () => {
    const known = ProviderService.getKnownModels();
    expect(known.opencode).toBeDefined();
    expect(known.opencode['deepseek-v4-flash-free']).toBeDefined();
  });

  it('应获取账户映射表', () => {
    const map = ProviderService.getAccountToProviderMap();
    expect(map['agnes-ai']).toBe('opencode');
  });
});
