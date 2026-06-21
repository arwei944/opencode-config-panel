/**
 * ============================================================
 * 组合器：ServerComposer
 * 描述：服务端组合器 — 将适配器注入核心服务，组装完整应用
 * 约束：
 *   1. 单向依赖：适配器 → 端口 ← 服务
 *   2. 组合优先：所有依赖通过构造函数注入
 *   3. 本组合器是 server/ 目录的唯一组装点
 * ============================================================
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// 端口接口
import type { IConfigPort, IBackupPort, IFileSystemPort, IConnectionTestPort, IValidationPort } from '../core/ports';

// 核心服务
import {
  ConfigService,
  ProviderService,
  AgentService,
  ToolService,
  SkillService,
  McpService,
  HooksService,
} from '../core/services';

// 适配器
import { FileSystemConfigAdapter } from './adapters/FileSystemConfigAdapter';
import { FileSystemBackupAdapter } from './adapters/FileSystemBackupAdapter';
import { FileSystemAdapter } from './adapters/FileSystemAdapter';
import { ConnectionTestAdapter } from './adapters/ConnectionTestAdapter';
import { ValidationAdapter } from './adapters/ValidationAdapter';

// 路径工具
import {
  getConfigPath,
  getBackupsDir,
  getSkillsDir,
  getAgentsDir,
  getAgentFilePath,
  getSkillFilePath,
  getAuthPath,
  getAccountPath,
} from './utils/paths';

// ============================================================
// 组合器输出接口
// ============================================================
export interface ServerComposition {
  configService: ConfigService;
  providerService: ProviderService;
  agentService: AgentService;
  toolService: ToolService;
  skillService: SkillService;
  mcpService: McpService;
  hooksService: HooksService;
}

/**
 * ServerComposer
 * 组合所有适配器和服务，返回组装后的服务实例
 */
export function composeServer(): ServerComposition {
  // 1. 创建适配器实例
  const fileSystemAdapter: IFileSystemPort = new FileSystemAdapter();
  const configAdapter: IConfigPort = new FileSystemConfigAdapter({
    configPath: getConfigPath(),
    countSkills: async () => countSkillsFromDisk(fileSystemAdapter),
    countProviders: async (config) => countProvidersMerged(config, fileSystemAdapter),
    countModels: async (config) => countModelsMerged(config, fileSystemAdapter),
  });
  const backupAdapter: IBackupPort = new FileSystemBackupAdapter({
    backupsDir: getBackupsDir(),
    configPath: getConfigPath(),
  });
  const connectionTestAdapter: IConnectionTestPort = new ConnectionTestAdapter();
  const validationAdapter: IValidationPort = new ValidationAdapter();

  // 2. 组装服务 — 通过构造函数注入适配器
  const configService = new ConfigService({
    configPort: configAdapter,
    backupPort: backupAdapter,
    validationPort: validationAdapter,
    autoBackup: true,
    maxBackups: 10,
  });

  const providerService = new ProviderService({
    configPort: configAdapter,
    connectionTestPort: connectionTestAdapter,
    readAuthAccounts: async () => {
      try {
        const raw = await fs.readFile(getAuthPath(), 'utf-8');
        return JSON.parse(raw);
      } catch {
        return {};
      }
    },
    readAccountData: async () => {
      try {
        const raw = await fs.readFile(getAccountPath(), 'utf-8');
        const account = JSON.parse(raw);
        return account.accounts || {};
      } catch {
        return {};
      }
    },
  });

  const agentService = new AgentService({
    configPort: configAdapter,
    fileSystemPort: fileSystemAdapter,
    agentsDir: getAgentsDir(),
    getAgentFilePath,
  });

  const toolService = new ToolService({ configPort: configAdapter });
  const skillService = new SkillService({
    configPort: configAdapter,
    fileSystemPort: fileSystemAdapter,
    skillsDir: getSkillsDir(),
    getSkillFilePath,
  });
  const mcpService = new McpService({ configPort: configAdapter });
  const hooksService = new HooksService({ configPort: configAdapter });

  return {
    configService,
    providerService,
    agentService,
    toolService,
    skillService,
    mcpService,
    hooksService,
  };
}

// ============================================================
// 辅助函数（组合器的私有工具）
// ============================================================

/** 从磁盘统计技能数量 */
async function countSkillsFromDisk(fsPort: IFileSystemPort): Promise<number> {
  try {
    const entries = await fsPort.readDir(getSkillsDir());
    let count = 0;
    for (const entry of entries) {
      if (entry.isDirectory) {
        try {
          await fsPort.readFile(getSkillFilePath(entry.name));
          count++;
        } catch {
          // 目录中没有 SKILL.md，不计入
        }
      }
    }
    return count;
  } catch {
    return 0;
  }
}

/** 合并统计提供商数量（opencode.json + auth.json 去重） */
async function countProvidersMerged(
  config: { provider?: Record<string, unknown> },
  fsPort: IFileSystemPort,
): Promise<number> {
  const jsonProviders = config.provider || {};
  const providerNames = new Set(Object.keys(jsonProviders));

  try {
    const raw = await fsPort.readFile(getAuthPath());
    const auth = JSON.parse(raw);
    for (const accountName of Object.keys(auth)) {
      const providerName = accountName === 'agnes-ai' ? 'opencode' : accountName;
      providerNames.add(providerName);
    }
  } catch {
    // auth.json 不存在
  }

  return providerNames.size;
}

/** 合并统计模型数量 */
async function countModelsMerged(
  config: { provider?: Record<string, { models?: Record<string, unknown> }> },
  fsPort: IFileSystemPort,
): Promise<number> {
  const jsonProviders = config.provider || {};
  let count = 0;

  for (const provider of Object.values(jsonProviders)) {
    if (provider?.models) {
      count += Object.keys(provider.models).length;
    }
  }

  // 补充 opencode 的已知模型
  const hasOpencode = jsonProviders['opencode'] || await (async () => {
    try {
      const raw = await fsPort.readFile(getAuthPath());
      const auth = JSON.parse(raw);
      return !!auth['agnes-ai'];
    } catch {
      return false;
    }
  })();

  if (hasOpencode && (!jsonProviders['opencode'] || !jsonProviders['opencode'].models)) {
    count += 5; // opencode 内置模型数
  }

  return count;
}
