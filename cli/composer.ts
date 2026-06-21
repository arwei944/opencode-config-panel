/**
 * ============================================================
 * CLI 组合器
 * 组装所有适配器 → 核心服务 → CLI 上下文
 * ============================================================
 */

import path from 'node:path';
import os from 'node:os';
import type { CliGlobalOptions, CliContext } from './types';
import { NodeTerminalAdapter } from './adapters/NodeTerminalAdapter';
import { NodeUserInteractionAdapter } from './adapters/NodeUserInteractionAdapter';
import { dispatch } from './registry';
import { helpHandler } from './commands/help';

// 核心服务
import { ConfigService } from '../core/services/ConfigService';
import { ProviderService } from '../core/services/ProviderService';
import { AgentService } from '../core/services/AgentService';
import { ToolService } from '../core/services/ToolService';
import { SkillService } from '../core/services/SkillService';
import { McpService } from '../core/services/McpService';
import { HooksService } from '../core/services/HooksService';

// CLI 服务
import { AuditService } from './services/AuditService';

// 适配器（来自 server/adapters — 可复用）
import { FileSystemConfigAdapter } from '../server/adapters/FileSystemConfigAdapter';
import { FileSystemBackupAdapter } from '../server/adapters/FileSystemBackupAdapter';
import { FileSystemAdapter } from '../server/adapters/FileSystemAdapter';

// 端口类型
import type { IConfigPort, IBackupPort, IFileSystemPort, IValidationPort } from '../core/ports';

/** 默认验证实现（简单 JSON 结构校验） */
class DefaultValidationPort implements IValidationPort {
  validate(config: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!config || typeof config !== 'object') {
      errors.push('配置必须是 JSON 对象');
      return { valid: false, errors };
    }
    const c = config as Record<string, unknown>;
    if (c.provider !== undefined && (typeof c.provider !== 'object' || Array.isArray(c.provider))) {
      errors.push('provider 必须是对象');
    }
    if (c.agent !== undefined && (typeof c.agent !== 'object' || Array.isArray(c.agent))) {
      errors.push('agent 必须是对象');
    }
    return { valid: errors.length === 0, errors };
  }
}

/** 运行 CLI */
export async function runCLI(argv: string[]): Promise<void> {
  // 路径常量
  const CONFIG_DIR = path.join(os.homedir(), '.config', 'opencode');
  const CONFIG_PATH = path.join(CONFIG_DIR, 'opencode.json');
  const BACKUPS_DIR = path.join(CONFIG_DIR, 'backups');

  // 创建适配器
  const term = new NodeTerminalAdapter();
  const prompt = new NodeUserInteractionAdapter();
  const configAdapter = new FileSystemConfigAdapter({ configPath: CONFIG_PATH });
  const backupAdapter = new FileSystemBackupAdapter({ backupsDir: BACKUPS_DIR, configPath: CONFIG_PATH });
  const fileSystemAdapter = new FileSystemAdapter();
  const validationPort = new DefaultValidationPort();

  // 解析全局选项
  const options: CliGlobalOptions = {
    json: false,
    yes: false,
    dryRun: false,
    quiet: false,
    verbose: false,
    color: true,
  };

  const cmdArgs: string[] = [];
  let cmd: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--') || a === '-y' || a === '-q' || a === '-v') {
      switch (a) {
        case '--json': options.json = true; break;
        case '--yes':
        case '-y': options.yes = true; break;
        case '--dry-run': options.dryRun = true; break;
        case '--quiet':
        case '-q': options.quiet = true; break;
        case '--verbose':
        case '-v': options.verbose = true; break;
        case '--no-color': options.color = false; break;
        default: cmdArgs.push(a); break;
      }
    } else {
      if (cmd === null) cmd = a;
      else cmdArgs.push(a);
    }
  }

  // 应用全局选项
  term.setOptions({ json: options.json, quiet: options.quiet, color: options.color });
  prompt.setAutoConfirm(options.yes);

  // 审计日志服务
  const logsDir = path.join(CONFIG_DIR, 'logs');
  const audit = new AuditService({
    fs: fileSystemAdapter,
    logsDir,
  });

  if (!cmd) {
    await helpHandler([], {
      options,
      term,
      prompt,
      fs: fileSystemAdapter,
      configPort: configAdapter,
      backupPort: backupAdapter,
      services: null as never, // 仅用于 help
      audit, // help 需要 context 类型完整
    });
    return;
  }

  // 创建核心服务
  const configService = new ConfigService({
    configPort: configAdapter,
    backupPort: backupAdapter,
    validationPort,
    autoBackup: true,
    maxBackups: 10,
  });

  const providerService = new ProviderService({
    configPort: configAdapter,
    connectionTestPort: {
      test: async (params) => {
        // CLI 环境下的简单连接测试（跳过实际 HTTP 请求）
        try {
          new URL(params.baseURL);
          return { reachable: true, latencyMs: 0, modelsFetched: 0, error: null };
        } catch {
          return { reachable: false, latencyMs: 0, modelsFetched: 0, error: 'URL 格式无效' };
        }
      },
      detect: async (baseURL: string, _apiKey?: string) => {
        // 简单 URL 探测规则
        const rules = [
          { pattern: /openai\.com/i, type: 'openai', name: 'openai' },
          { pattern: /anthropic\.com/i, type: 'anthropic', name: 'anthropic' },
          { pattern: /googleapis\.com/i, type: 'google', name: 'google' },
          { pattern: /deepseek\.com/i, type: 'openai', name: 'deepseek' },
          { pattern: /azure\.com/i, type: 'openai', name: 'azure' },
          { pattern: /github\.com/i, type: 'openai', name: 'github' },
        ];
        for (const r of rules) {
          if (r.pattern.test(baseURL)) {
            return { name: r.name, type: r.type, baseURL, models: {} };
          }
        }
        // 默认
        const name = new URL(baseURL).hostname.split('.')[0]?.replace(/[^a-z0-9-]/g, '') || 'custom';
        return { name, type: 'openai', baseURL, models: {} };
      },
    },
  });

  const AGENTS_DIR = path.join(CONFIG_DIR, 'agents');
  const SKILLS_DIR = path.join(CONFIG_DIR, 'skills');

  const agentService = new AgentService({
    configPort: configAdapter,
    fileSystemPort: fileSystemAdapter,
    agentsDir: AGENTS_DIR,
    getAgentFilePath: (name: string) => path.join(AGENTS_DIR, `${name}.md`),
  });
  const toolService = new ToolService({ configPort: configAdapter });
  const skillService = new SkillService({
    configPort: configAdapter,
    fileSystemPort: fileSystemAdapter,
    skillsDir: SKILLS_DIR,
    getSkillFilePath: (name: string) => path.join(SKILLS_DIR, name, 'SKILL.md'),
  });
  const mcpService = new McpService({ configPort: configAdapter });
  const hooksService = new HooksService({ configPort: configAdapter });

  // 创建 CLI 上下文（audit 已在 if 之前创建）
  const context: CliContext = {
    options,
    term,
    prompt,
    fs: fileSystemAdapter,
    configPort: configAdapter,
    backupPort: backupAdapter,
    services: {
      config: configService,
      provider: providerService,
      agent: agentService,
      tool: toolService,
      skill: skillService,
      mcp: mcpService,
      hook: hooksService,
    },
    audit,
  };

  // 分发命令
  try {
    const found = await dispatch(cmd, cmdArgs, context);
    if (!found) {
      term.err(`未知命令: ${cmd}`);
      await helpHandler([], context);
      process.exit(1);
    }
  } catch (e) {
    term.err((e as Error).message);
    process.exit(1);
  }
}
