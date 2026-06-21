/**
 * ============================================================
 * CLI 专用类型定义
 * ============================================================
 */

import type { ITerminalPort } from './ports/ITerminalPort';
import type { IUserInteractionPort } from './ports/IUserInteractionPort';
import type { ConfigService, ProviderService, AgentService, ToolService, SkillService, McpService, HooksService } from '../core/services';
import type { IFileSystemPort, IBackupPort, IConfigPort } from '../core/ports';

/** CLI 全局选项 */
export interface CliGlobalOptions {
  json: boolean;
  yes: boolean;
  dryRun: boolean;
  quiet: boolean;
  verbose: boolean;
  color: boolean;
}

/** 命令处理函数签名 */
export type CommandHandler = (args: string[], context: CliContext) => Promise<void>;

/** 命令定义 */
export interface CommandDefinition {
  name: string;
  aliases: string[];
  description: string;
  handler: CommandHandler;
  /** 子命令（如果有嵌套） */
  subcommands?: Record<string, CommandDefinition>;
}

/** CLI 上下文 — 所有端口和服务的聚合 */
export interface CliContext {
  /** 全局选项 */
  options: CliGlobalOptions;
  /** 终端输出 */
  term: ITerminalPort;
  /** 用户交互 */
  prompt: IUserInteractionPort;
  /** 文件系统 */
  fs: IFileSystemPort;
  /** 配置端口 */
  configPort: IConfigPort;
  /** 备份端口 */
  backupPort: IBackupPort;
  /** 核心服务 */
  services: {
    config: ConfigService;
    provider: ProviderService;
    agent: AgentService;
    tool: ToolService;
    skill: SkillService;
    mcp: McpService;
    hook: HooksService;
  };
}
