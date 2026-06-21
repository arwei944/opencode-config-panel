/**
 * ============================================================
 * 原子：OpenCodeConfig
 * 描述：opencode.json 完整配置结构（最小不可变单元）
 * 约束：本原子不可修改，所有变更应通过 Port 接口进行
 * ============================================================
 */

import type { ProviderConfig } from './provider';
import type { AgentConfig } from './agent';
import type { McpLocalConfig, McpRemoteConfig, McpSimpleConfig } from './mcp';
import type { PermissionConfig } from './permission';
import type { CommandConfig, ServerConfig } from './system';
import type {
  SkillSourcesConfig,
  ReferenceConfigEntry,
  AttachmentConfig,
  ToolOutputConfig,
  CompactionConfig,
  FormatterEntry,
  LspEntry,
  TuiConfig,
  ExperimentalConfig,
} from './system';

/** opencode.json 顶级配置原子 */
export interface OpenCodeConfig {
  $schema?: string;
  theme?: string;
  logLevel?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  shell?: string;
  default_agent?: string;
  username?: string;

  /** 默认模型（格式：provider/model） */
  model?: string;
  /** 小模型（格式：provider/model） */
  small_model?: string;

  /** 提供商配置 */
  provider?: Record<string, ProviderConfig>;
  /** 代理配置 */
  agent?: Record<string, AgentConfig>;
  /** MCP 服务器 */
  mcp?: Record<string, McpLocalConfig | McpRemoteConfig | McpSimpleConfig>;
  /** 工具开关 */
  tools?: Record<string, boolean>;
  /** 权限配置 */
  permission?: PermissionConfig;
  /** 快捷键 */
  keybinds?: Record<string, string>;
  /** 指令 */
  instructions?: string[];
  /** 自定义命令 */
  command?: Record<string, CommandConfig>;
  /** 服务器配置 */
  server?: ServerConfig;
  /** 技能源 */
  skills?: SkillSourcesConfig;
  /** 引用 */
  reference?: Record<string, ReferenceConfigEntry>;
  /** 附件 */
  attachment?: AttachmentConfig;
  /** 工具输出 */
  tool_output?: ToolOutputConfig;
  /** 压缩 */
  compaction?: CompactionConfig;
  /** 格式化器 */
  formatter?: Record<string, FormatterEntry> | false;
  /** LSP */
  lsp?: Record<string, LspEntry> | false;
  /** 文件监控 */
  watcher?: { ignore?: string[] };
  /** TUI */
  tui?: TuiConfig;
  /** 插件 */
  plugin?: (string | [string, Record<string, unknown>])[];
  /** 快照 */
  snapshot?: boolean;
  /** 共享模式 */
  share?: 'manual' | 'auto' | 'disabled';
  autoshare?: boolean;
  autoupdate?: boolean | 'notify';
  disabled_providers?: string[];
  enabled_providers?: string[];
  enterprise?: { url?: string };
  /** 布局（已废弃） */
  layout?: 'auto' | 'stretch';
  /** 实验性功能 */
  experimental?: ExperimentalConfig;
  /** 模式（已废弃） */
  mode?: Record<string, AgentConfig>;
}

/** 配置摘要原子 */
export interface ConfigSummary {
  providerCount: number;
  modelCount: number;
  agentCount: number;
  mcpCount: number;
  skillCount: number;
  toolCount: number;
  configSize: number;
  lastModified: string;
  configPath: string;
}
