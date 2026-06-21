/**
 * ============================================================
 * 前端 API 请求/响应类型定义
 * 兼容层：从原子层重新导出
 * ============================================================
 */

import type { OpenCodeConfig, ConfigSummary } from '@shared/atoms';

// ============================================================
// 通用 API 响应
// ============================================================
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

// ============================================================
// 配置 API
// ============================================================
export interface ConfigResponse {
  config: OpenCodeConfig;
  summary: ConfigSummary;
}

export interface ValidateResult {
  valid: boolean;
  errors: string[];
}

export interface ExportResult {
  config: OpenCodeConfig;
  exportedAt: string;
}

// ============================================================
// 提供商 API
// ============================================================
export interface ProvidersResponse {
  providers: Record<string, unknown>;
}

export interface TestConnectionResult {
  reachable: boolean;
  latencyMs: number;
  modelsFetched: number;
  error: string | null;
}

// ============================================================
// 工具 API
// ============================================================
export interface ToolInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  builtin: boolean;
  source: string | null;
  enabled: boolean;
  agentOverrides: Record<string, boolean | null>;
}

export interface ToolsResponse {
  tools: ToolInfo[];
  globalToolSettings: Record<string, boolean>;
  primaryTools: string[];
}

// ============================================================
// 代理 API
// ============================================================
export interface AgentInfo {
  name: string;
  filePath: string;
  config: Record<string, unknown>;
  fileFrontmatter: Record<string, unknown>;
  fileContent: string;
}

export interface AgentsResponse {
  agents: AgentInfo[];
}

// ============================================================
// 技能 API
// ============================================================
export interface SkillInfo {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  severity?: 'mandatory' | 'optional';
  persistence?: 'session' | 'infinite';
  content: string;
  filePath: string;
  enabled: boolean;
}

export interface SkillsResponse {
  skills: SkillInfo[];
  permissions: Record<string, string>;
}

// ============================================================
// MCP API
// ============================================================
export interface McpServerInfo {
  name: string;
  config: Record<string, unknown>;
}

// ============================================================
// 备份 API
// ============================================================
export interface BackupInfo {
  id: string;
  timestamp: string;
  size: number;
  path: string;
}

export interface BackupCreateResult {
  backupId: string;
  path: string;
  timestamp: string;
}

// ============================================================
// 钩子 API
// ============================================================
export interface HooksConfig {
  file_edited?: Record<string, { command: string[]; environment?: Record<string, string> }[]>;
  session_completed?: { command: string[]; environment?: Record<string, string> }[];
}

// ============================================================
// 高级设置 API
// ============================================================
export interface AdvancedSettings {
  server?: Record<string, unknown>;
  compaction?: Record<string, unknown>;
  reference?: Record<string, unknown>;
  attachment?: Record<string, unknown>;
  tool_output?: Record<string, unknown>;
  policies?: Record<string, unknown>[];
  watcher?: Record<string, unknown>;
  formatter?: Record<string, unknown>;
  lsp?: Record<string, unknown>;
  enterprise?: Record<string, unknown>;
}
