/**
 * 集成测试：Composer 装配 + 适配器注入
 *
 * 测试目标：
 *   1. 使用真实适配器（FileSystemConfigAdapter 等）+ 临时目录
 *   2. 验证 Composer 装配后的完整端到端流程
 *   3. 确保所有依赖正确注入，无运行时错误
 *
 * 约束验证：
 *   - 单向依赖：服务 → 端口 ← 适配器
 *   - 端口隔离：服务只通过端口接口调用适配器
 *   - 组合优先：所有依赖通过构造函数注入
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// 端口接口
import type { IConfigPort, IBackupPort, IFileSystemPort, IConnectionTestPort, IValidationPort } from '../../core/ports';

// 适配器
import { FileSystemConfigAdapter } from '../../server/adapters/FileSystemConfigAdapter';
import { FileSystemBackupAdapter } from '../../server/adapters/FileSystemBackupAdapter';
import { FileSystemAdapter } from '../../server/adapters/FileSystemAdapter';
import { ConnectionTestAdapter } from '../../server/adapters/ConnectionTestAdapter';
import { ValidationAdapter } from '../../server/adapters/ValidationAdapter';

// 核心服务
import {
  ConfigService,
  ProviderService,
  AgentService,
  ToolService,
  SkillService,
  McpService,
  HooksService,
} from '../../core/services';

// ============================================================
// 测试夹具：临时目录
// ============================================================

interface TempDirs {
  root: string;
  agents: string;
  skills: string;
  backups: string;
  configPath: string;
}

async function createTempDirs(): Promise<TempDirs> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-integration-'));
  const agents = path.join(root, 'agents');
  const skills = path.join(root, 'skills');
  const backups = path.join(root, 'backups');
  const configPath = path.join(root, 'opencode.json');

  await fs.mkdir(agents, { recursive: true });
  await fs.mkdir(skills, { recursive: true });
  await fs.mkdir(backups, { recursive: true });

  return { root, agents, skills, backups, configPath };
}

async function cleanupTempDirs(dirs: TempDirs): Promise<void> {
  await fs.rm(dirs.root, { recursive: true, force: true });
}

function createSkillFilePath(base: string) {
  return (name: string) => path.join(base, name, 'SKILL.md');
}

function createAgentFilePath(base: string) {
  return (name: string) => path.join(base, `${name}.md`);
}

// ============================================================
// 集成测试套件
// ============================================================

describe('集成测试：Composer 装配 + 端到端流程', () => {
  let dirs: TempDirs;
  let configAdapter: IConfigPort;
  let backupAdapter: IBackupPort;
  let fsAdapter: IFileSystemPort;
  let connectionAdapter: IConnectionTestPort;
  let validationAdapter: IValidationPort;

  // 服务实例
  let configService: ConfigService;
  let providerService: ProviderService;
  let agentService: AgentService;
  let toolService: ToolService;
  let skillService: SkillService;
  let mcpService: McpService;
  let hooksService: HooksService;

  beforeAll(async () => {
    dirs = await createTempDirs();

    // 1. 适配器
    configAdapter = new FileSystemConfigAdapter({
      configPath: dirs.configPath,
      countSkills: async () => 0,
      countProviders: async () => 0,
      countModels: async () => 0,
    });
    backupAdapter = new FileSystemBackupAdapter({
      backupsDir: dirs.backups,
      configPath: dirs.configPath,
    });
    fsAdapter = new FileSystemAdapter();
    connectionAdapter = new ConnectionTestAdapter();
    validationAdapter = new ValidationAdapter();

    // 2. 服务 — 通过构造函数注入适配器
    configService = new ConfigService({
      configPort: configAdapter,
      backupPort: backupAdapter,
      validationPort: validationAdapter,
      autoBackup: true,
      maxBackups: 5,
    });

    providerService = new ProviderService({
      configPort: configAdapter,
      connectionTestPort: connectionAdapter,
      readAuthAccounts: async () => ({}),
      readAccountData: async () => ({}),
    });

    agentService = new AgentService({
      configPort: configAdapter,
      fileSystemPort: fsAdapter,
      agentsDir: dirs.agents,
      getAgentFilePath: createAgentFilePath(dirs.agents),
    });

    toolService = new ToolService({ configPort: configAdapter });

    skillService = new SkillService({
      configPort: configAdapter,
      fileSystemPort: fsAdapter,
      skillsDir: dirs.skills,
      getSkillFilePath: createSkillFilePath(dirs.skills),
    });

    mcpService = new McpService({ configPort: configAdapter });
    hooksService = new HooksService({ configPort: configAdapter });
  });

  afterAll(async () => {
    await cleanupTempDirs(dirs);
  });

  // ============================================================
  // 1. ConfigService — 完整 CRUD
  // ============================================================
  describe('ConfigService 端到端', () => {
    it('初始配置应读取为空对象', async () => {
      const config = await configService.getConfig();
      expect(config).toEqual({});
    });

    it('应写入配置并读取', async () => {
      await configService.replaceConfig({ provider: { openai: { apiKey: 'sk-test' } } } as any);
      const config = await configService.getConfig();
      expect(config.provider).toBeDefined();
      expect((config.provider as any).openai.apiKey).toBe('sk-test');
    });

    it('应分步更新配置而不丢失字段', async () => {
      await configService.updateConfig({ tools: { read: true, edit: false } });
      const config = await configService.getConfig();
      expect(config.provider).toBeDefined(); // 保留之前写入的
      expect(config.tools).toBeDefined();
      expect((config.tools as any).read).toBe(true);
    });

    it('应获取配置摘要', async () => {
      const summary = await configService.getSummary();
      expect(summary).toHaveProperty('providerCount');
      expect(summary).toHaveProperty('configSize');
      expect(summary).toHaveProperty('lastModified');
    });

    it('应导出配置', async () => {
      const result = await configService.exportConfig();
      expect(result).toHaveProperty('config');
      expect(result).toHaveProperty('exportedAt');
    });

    it('应列出备份', async () => {
      const backups = await configService.listBackups();
      expect(Array.isArray(backups)).toBe(true);
    });
  });

  // ============================================================
  // 2. ProviderService — 提供商管理
  // ============================================================
  describe('ProviderService 端到端', () => {
    it('应列出提供商', async () => {
      const result = await providerService.list();
      expect(result).toHaveProperty('openai');
    });

    it('应获取提供商详情', async () => {
      const detail = await providerService.get('openai');
      expect(detail).toBeDefined();
      expect(detail).toHaveProperty('apiKey');
    });

    it('应自动检测提供商类型', async () => {
      const result = await providerService.detect('http://localhost:9999');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('models');
    });
  });

  // ============================================================
  // 3. AgentService — 代理管理
  // ============================================================
  describe('AgentService 端到端', () => {
    const agentName = 'integration-test-agent';

    afterAll(async () => {
      try { await agentService.delete(agentName); } catch { /* ignore */ }
    });

    it('应创建代理', async () => {
      const result = await agentService.create(agentName, {
        mode: 'subagent',
        description: '集成测试代理',
      });
      expect(result.name).toBe(agentName);
      expect(result.config.mode).toBe('subagent');
      expect(result.filePath).toBeTruthy();
    });

    it('应在列表中看到新代理', async () => {
      const agents = await agentService.list();
      const names = agents.map(a => a.name);
      expect(names).toContain(agentName);
    });

    it('应更新代理描述', async () => {
      await agentService.update(agentName, { description: '已更新描述' });
      const agents = await agentService.list();
      const agent = agents.find(a => a.name === agentName);
      expect(agent!.config.description).toBe('已更新描述');
    });

    it('应拒绝重复创建', async () => {
      await expect(
        agentService.create(agentName, { mode: 'subagent' })
      ).rejects.toThrow('已存在');
    });
  });

  // ============================================================
  // 4. ToolService — 工具管理
  // ============================================================
  describe('ToolService 端到端', () => {
    it('应列出工具', async () => {
      const result = await toolService.list();
      expect(result.tools).toBeDefined();
      expect(result.tools.length).toBeGreaterThan(0);
      expect(result.globalToolSettings).toBeDefined();
      expect(result.primaryTools).toBeDefined();
    });

    it('应更新全局工具设置', async () => {
      await toolService.updateGlobal({ read: true, edit: false });
      const config = await configService.getConfig();
      expect(config.tools).toEqual({ read: true, edit: false });
    });
  });

  // ============================================================
  // 5. SkillService — 技能管理
  // ============================================================
  describe('SkillService 端到端', () => {
    const skillName = 'integration-test-skill';

    afterAll(async () => {
      try { await skillService.delete(skillName); } catch { /* ignore */ }
    });

    it('应创建技能', async () => {
      const result = await skillService.create({
        name: skillName,
        description: '集成测试技能',
        content: '# 集成测试技能\n\n这是一个测试技能。',
      });
      expect(result.name).toBe(skillName);
      expect(result.description).toBe('集成测试技能');
      expect(result.filePath).toBeTruthy();
    });

    it('应扫描到新技能', async () => {
      const result = await skillService.scan();
      const found = result.skills.find(s => s.name === skillName);
      expect(found).toBeDefined();
      expect(found!.description).toBe('集成测试技能');
    });

    it('应更新技能', async () => {
      await skillService.update(skillName, { description: '已更新技能描述' });
      const updated = await skillService.readFile(skillName);
      expect(updated.frontmatter.description).toBe('已更新技能描述');
    });
  });

  // ============================================================
  // 6. McpService — MCP 服务器管理
  // ============================================================
  describe('McpService 端到端', () => {
    const serverName = 'integration-test-mcp';

    afterAll(async () => {
      try { await mcpService.delete(serverName); } catch { /* ignore */ }
    });

    it('应添加 MCP 服务器', async () => {
      const result = await mcpService.add(serverName, {
        url: 'http://localhost:9999/mcp',
        enabled: true,
      });
      expect(result.url).toBe('http://localhost:9999/mcp');
      expect(result.enabled).toBe(true);
    });

    it('应列出 MCP 服务器', async () => {
      const result = await mcpService.list();
      expect(result).toBeDefined();
      expect(Object.keys(result)).toContain(serverName);
    });

    it('应获取 MCP 服务器详情', async () => {
      const servers = await mcpService.list();
      expect(servers[serverName]).toBeDefined();
      expect(servers[serverName].url).toBe('http://localhost:9999/mcp');
    });
  });

  // ============================================================
  // 7. HooksService — 钩子管理
  // ============================================================
  describe('HooksService 端到端', () => {
    it('初始钩子应返回空对象', async () => {
      const hooks = await hooksService.get();
      expect(hooks).toEqual({});
    });

    it('应设置钩子', async () => {
      const result = await hooksService.replace({
        'pre-commit': { command: 'npm test' },
      });
      expect(result['pre-commit'].command).toBe('npm test');
    });

    it('应读取钩子', async () => {
      const hooks = await hooksService.get();
      expect(hooks['pre-commit']).toBeDefined();
      expect(hooks['pre-commit'].command).toBe('npm test');
    });
  });

  // ============================================================
  // 8. 组合操作 — 多服务协同
  // ============================================================
  describe('多服务协同', () => {
    it('应能连续执行多服务操作', async () => {
      // Config → Provider → Agent → Tool → Skill → MCP → Hooks
      await configService.updateConfig({
        provider: { anthropic: { apiKey: 'sk-anthropic' } },
        agent: { 'multi-agent': { mode: 'primary' } },
      } as any);

      const config = await configService.getConfig();

      // 验证所有服务都能读取到变更
      const providers = await providerService.list();
      expect(providers).toHaveProperty('anthropic');

      const agents = await agentService.list();
      const agentNames = agents.map(a => a.name);
      expect(agentNames).toContain('multi-agent');

      // Tools 不受影响
      const tools = await toolService.list();
      expect(tools.tools.length).toBeGreaterThan(0);

      // 清理
      await configService.replaceConfig({
        provider: { anthropic: { apiKey: 'sk-anthropic' } },
        agent: { 'multi-agent': { mode: 'primary' } },
        ...Object.fromEntries(
          Object.entries(config).filter(([k]) => !['provider', 'agent'].includes(k))
        ),
      } as any);
    }, 10000);
  });
});

// ============================================================
// 集成测试：Composer 装配验证
// ============================================================

describe('集成测试：Composer 装配验证', () => {
  it('应使用临时目录装配完整服务栈', async () => {
    const dirs = await createTempDirs();

    try {
      // 模拟 server/composer.ts 的装配过程
      const fsAdapter = new FileSystemAdapter();
      const configAdapter = new FileSystemConfigAdapter({
        configPath: dirs.configPath,
        countSkills: async () => 0,
        countProviders: async () => 0,
        countModels: async () => 0,
      });
      const backupAdapter = new FileSystemBackupAdapter({
        backupsDir: dirs.backups,
        configPath: dirs.configPath,
      });
      const connectionAdapter = new ConnectionTestAdapter();
      const validationAdapter = new ValidationAdapter();

      const configService = new ConfigService({
        configPort: configAdapter,
        backupPort: backupAdapter,
        validationPort: validationAdapter,
        autoBackup: true,
        maxBackups: 5,
      });

      const providerService = new ProviderService({
        configPort: configAdapter,
        connectionTestPort: connectionAdapter,
        readAuthAccounts: async () => ({ accounts: {} }),
        readAccountData: async () => ({ accounts: {} }),
      });

      const agentService = new AgentService({
        configPort: configAdapter,
        fileSystemPort: fsAdapter,
        agentsDir: dirs.agents,
        getAgentFilePath: createAgentFilePath(dirs.agents),
      });

      const toolService = new ToolService({ configPort: configAdapter });

      const skillService = new SkillService({
        configPort: configAdapter,
        fileSystemPort: fsAdapter,
        skillsDir: dirs.skills,
        getSkillFilePath: createSkillFilePath(dirs.skills),
      });

      const mcpService = new McpService({ configPort: configAdapter });
      const hooksService = new HooksService({ configPort: configAdapter });

      // 验证所有服务实例都已创建
      expect(configService).toBeInstanceOf(ConfigService);
      expect(providerService).toBeInstanceOf(ProviderService);
      expect(agentService).toBeInstanceOf(AgentService);
      expect(toolService).toBeInstanceOf(ToolService);
      expect(skillService).toBeInstanceOf(SkillService);
      expect(mcpService).toBeInstanceOf(McpService);
      expect(hooksService).toBeInstanceOf(HooksService);

      // 验证端到端读写
      const config = await configService.getConfig();
      expect(config).toEqual({});
    } finally {
      await cleanupTempDirs(dirs);
    }
  });
});
