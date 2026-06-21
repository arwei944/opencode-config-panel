/**
 * ============================================================
 * 前端配置类型定义
 * 兼容层：从原子层重新导出，保持旧导入路径可用
 * 注意：不要再在此文件中定义新类型，改在 shared/atoms/ 中添加
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
} from '@shared/atoms';
