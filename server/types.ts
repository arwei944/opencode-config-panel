/**
 * ============================================================
 * 后端类型定义
 * 兼容层：从原子层重新导出，保持旧导入路径可用
 * ============================================================
 */

export type {
  OpenCodeConfig,
  ConfigSummary,
  ProviderConfig,
  ModelConfig,
  AgentConfig,
  McpLocalConfig,
  McpRemoteConfig,
  McpSimpleConfig,
  McpOAuthConfig,
  PermissionAction,
  PermissionConfig,
  CommandConfig,
  ServerConfig,
  SkillSourcesConfig,
  ReferenceConfigEntry,
  AttachmentConfig,
  ToolOutputConfig,
  CompactionConfig,
  FormatterEntry,
  LspEntry,
  TuiConfig,
  ExperimentalConfig,
  HookCommand,
  ExperimentalPolicy,
  BackupInfo,
  ToolInfo,
  ToolCategory,
  SkillInfo,
  MarkdownFile,
} from '../shared/atoms';

// ============================================================
// API 响应类型（后端特有，不在共享层）
// ============================================================
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  badge?: number | string;
}

export type NavSection = string;
