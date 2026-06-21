/**
 * ConfigService 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigService } from '../../core/services/ConfigService';
import { MockConfigPort } from '../mocks/MockConfigPort';
import { MockBackupPort } from '../mocks/MockBackupPort';
import { MockValidationPort } from '../mocks/MockValidationPort';

describe('ConfigService', () => {
  let configPort: MockConfigPort;
  let backupPort: MockBackupPort;
  let validationPort: MockValidationPort;
  let service: ConfigService;

  beforeEach(() => {
    configPort = new MockConfigPort({
      model: 'test/model',
      default_agent: 'test-agent',
      agent: { 'test-agent': { mode: 'primary' } },
    });
    backupPort = new MockBackupPort();
    validationPort = new MockValidationPort();
    service = new ConfigService({
      configPort,
      backupPort,
      validationPort,
      autoBackup: false,
    });
  });

  it('应读取配置', async () => {
    const config = await service.getConfig();
    expect(config.model).toBe('test/model');
    expect(config.default_agent).toBe('test-agent');
  });

  it('应写入配置并更新缓存', async () => {
    await service.updateConfig({ model: 'new/model' });
    const config = await service.getConfig();
    expect(config.model).toBe('new/model');
    // 验证持久化
    const raw = await configPort.read();
    expect(raw.model).toBe('new/model');
  });

  it('应创建备份', async () => {
    const svcWithBackup = new ConfigService({
      configPort, backupPort, validationPort, autoBackup: true, maxBackups: 5,
    });
    await svcWithBackup.updateConfig({ model: 'backup-test/model' });
    // 应该自动创建了备份
    expect(backupPort.getCount()).toBeGreaterThanOrEqual(1);
  });

  it('应验证有效配置', () => {
    const result = service.validate({ model: 'a/b' });
    expect(result.valid).toBe(true);
  });

  it('应拒绝无效配置', () => {
    validationPort.setValid(false);
    validationPort.setErrors(['provider 必须是对象']);
    const result = service.validate({});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('provider 必须是对象');
  });

  it('应导出配置', async () => {
    const result = await service.exportConfig();
    expect(result.config.model).toBe('test/model');
    expect(result.exportedAt).toBeDefined();
  });

  it('应导入有效配置', async () => {
    const imported = await service.importConfig({ model: 'imported/model', provider: { test: { type: 'openai', options: { baseURL: 'https://test.com' } } } });
    expect(imported.model).toBe('imported/model');
  });

  it('应拒绝导入无效配置', async () => {
    validationPort.setValid(false);
    await expect(service.importConfig({} as never)).rejects.toThrow('配置验证失败');
  });

  it('应获取配置摘要', async () => {
    const summary = await service.getSummary();
    expect(summary.providerCount).toBe(0);
    expect(summary.agentCount).toBe(1);
    expect(summary.modelCount).toBe(0);
  });

  it('应手动创建备份', async () => {
    const info = await service.createBackupManually();
    expect(info.id).toBeDefined();
    expect(info.createdAt).toBeDefined();
  });

  it('应列出备份', async () => {
    await service.createBackupManually();
    const backups = await service.listBackups();
    expect(backups.length).toBe(1);
  });

  it('应清空缓存后重新加载', async () => {
    let config = await service.getConfig();
    expect(config.model).toBe('test/model');

    // 直接修改底层数据
    configPort.setData({ model: 'direct/model', agent: { 'test-agent': { mode: 'primary' } } });
    service.clearCache();

    config = await service.getConfig();
    expect(config.model).toBe('direct/model');
  });

  it('应处理并发读取', async () => {
    const [a, b] = await Promise.all([
      service.getConfig(),
      service.getConfig(),
    ]);
    expect(a.model).toBe('test/model');
    expect(b.model).toBe('test/model');
  });
});
