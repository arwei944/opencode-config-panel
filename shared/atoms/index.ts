/**
 * ============================================================
 * 原子层统一导出
 * 所有类型原子从此文件导出，外部仅可感知此入口
 * 约束：原子不可变，外部只读引用
 * ============================================================
 */

export type {
  OpenCodeConfig,
  ConfigSummary,
} from './config';

export type {
  ProviderConfig,
  ModelConfig,
  TestConnectionResult,
  TestConnectionParams,
  DetectResult,
  SmartAddResult,
} from './provider';

export type {
  AgentConfig,
  AgentInfo,
} from './agent';

export type {
  ToolInfo,
  ToolCategory,
  ToolListResult,
} from './tool';

export {
  BUILTIN_TOOLS,
  CATEGORY_ORDER,
} from './tool';

export type {
  SkillInfo,
  SkillScanResult,
  MarkdownFile,
} from './skill';

export type {
  McpLocalConfig,
  McpRemoteConfig,
  McpSimpleConfig,
  McpOAuthConfig,
  McpConfig,
} from './mcp';

export type {
  PermissionAction,
  PermissionConfig,
} from './permission';

export type {
  BackupInfo,
  BackupCreateResult,
  BackupFilterOptions,
} from './backup';

export type {
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
} from './system';

export type {
  NavSection,
  NavItem,
  NavSectionGroup,
  AppConfig,
} from './nav';
