/**
 * 前端配置类型定义
 * 与服务端类型同步，供前端组件使用
 */

// ============================================================
// 顶级配置
// ============================================================
export interface OpenCodeConfig {
  $schema?: string;
  theme?: string;
  logLevel?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  shell?: string;
  default_agent?: string;
  username?: string;
  model?: string;
  small_model?: string;
  provider?: Record<string, ProviderConfig>;
  agent?: Record<string, AgentConfig>;
  mcp?: Record<string, McpLocalConfig | McpRemoteConfig | McpSimpleConfig>;
  tools?: Record<string, boolean>;
  permission?: PermissionConfig;
  keybinds?: Record<string, string>;
  instructions?: string[];
  command?: Record<string, CommandConfig>;
  server?: ServerConfig;
  skills?: SkillSourcesConfig;
  reference?: Record<string, ReferenceConfigEntry>;
  attachment?: AttachmentConfig;
  tool_output?: ToolOutputConfig;
  compaction?: CompactionConfig;
  formatter?: Record<string, FormatterEntry> | false;
  lsp?: Record<string, LspEntry> | false;
  watcher?: { ignore?: string[] };
  tui?: TuiConfig;
  plugin?: (string | [string, Record<string, unknown>])[];
  snapshot?: boolean;
  share?: 'manual' | 'auto' | 'disabled';
  autoshare?: boolean;
  autoupdate?: boolean | 'notify';
  disabled_providers?: string[];
  enabled_providers?: string[];
  enterprise?: { url?: string };
  layout?: 'auto' | 'stretch';
  experimental?: ExperimentalConfig;
  mode?: Record<string, AgentConfig>;
}

// ============================================================
// 提供商
// ============================================================
export interface ProviderConfig {
  npm?: string;
  api?: string;
  name?: string;
  env?: string[];
  id?: string;
  options?: {
    baseURL?: string;
    apiKey?: string;
    enterpriseUrl?: string;
    setCacheKey?: boolean;
    timeout?: number | false;
    [key: string]: unknown;
  };
  models?: Record<string, ModelConfig>;
  whitelist?: string[];
  blacklist?: string[];
}

export interface ModelConfig {
  id: string;
  name?: string;
  release_date?: string;
  attachment?: boolean;
  reasoning?: boolean;
  temperature?: boolean;
  tool_call?: boolean;
  experimental?: boolean;
  status?: 'alpha' | 'beta' | 'deprecated' | 'active';
  cost?: {
    input?: number;
    output?: number;
    cache_read?: number;
    cache_write?: number;
  };
  limit?: {
    context?: number;
    output?: number;
  };
  modalities?: {
    input?: string[];
    output?: string[];
  };
}

// ============================================================
// 代理
// ============================================================
export interface AgentConfig {
  model?: string;
  variant?: string;
  temperature?: number;
  top_p?: number;
  prompt?: string;
  description?: string;
  mode?: 'subagent' | 'primary' | 'all';
  disable?: boolean;
  hidden?: boolean;
  color?: string;
  maxSteps?: number;
  steps?: number;
  tools?: Record<string, boolean>;
  permission?: PermissionConfig;
  options?: Record<string, unknown>;
}

// ============================================================
// MCP
// ============================================================
export interface McpLocalConfig {
  type?: 'local';
  command: string[];
  environment?: Record<string, string>;
  enabled?: boolean;
  timeout?: number;
}

export interface McpRemoteConfig {
  type?: 'remote';
  url: string;
  headers?: Record<string, string>;
  oauth?: McpOAuthConfig | false;
  enabled?: boolean;
}

export interface McpSimpleConfig {
  enabled: boolean;
}

export interface McpOAuthConfig {
  authorization_url: string;
  token_url: string;
  client_id: string;
  client_secret?: string;
  scopes?: string[];
}

// ============================================================
// 权限
// ============================================================
export type PermissionAction = 'ask' | 'allow' | 'deny';
export interface PermissionConfig {
  read?: PermissionAction | Record<string, PermissionAction>;
  edit?: PermissionAction | Record<string, PermissionAction>;
  glob?: PermissionAction | Record<string, PermissionAction>;
  grep?: PermissionAction | Record<string, PermissionAction>;
  list?: PermissionAction | Record<string, PermissionAction>;
  bash?: PermissionAction | Record<string, PermissionAction>;
  task?: PermissionAction | Record<string, PermissionAction>;
  webfetch?: PermissionAction;
  websearch?: PermissionAction;
  doom_loop?: PermissionAction;
  external_directory?: PermissionAction | Record<string, PermissionAction>;
  lsp?: PermissionAction | Record<string, PermissionAction>;
  todowrite?: PermissionAction;
  question?: PermissionAction;
  skill?: PermissionAction | Record<string, PermissionAction>;
  [key: string]: PermissionAction | Record<string, PermissionAction> | undefined;
}

// ============================================================
// 命令
// ============================================================
export interface CommandConfig {
  template: string;
  description?: string;
  agent?: string;
  model?: string;
  variant?: string;
  subtask?: boolean;
}

// ============================================================
// 服务器
// ============================================================
export interface ServerConfig {
  port?: number;
  hostname?: string;
  mdns?: boolean;
  mdnsDomain?: string;
  cors?: string[];
}

// ============================================================
// 其他配置
// ============================================================
export interface SkillSourcesConfig {
  paths?: string[];
  urls?: string[];
}

export type ReferenceConfigEntry = string | {
  repository: string;
  branch?: string;
} | { path: string };

export interface AttachmentConfig {
  image?: {
    auto_resize?: boolean;
    max_width?: number;
    max_height?: number;
    max_base64_bytes?: number;
  };
}

export interface ToolOutputConfig {
  max_lines?: number;
  max_bytes?: number;
}

export interface CompactionConfig {
  auto?: boolean;
  prune?: boolean;
  tail_turns?: number;
  preserve_recent_tokens?: number;
  reserved?: number;
}

export interface FormatterEntry {
  disabled?: boolean;
  command?: string[];
  environment?: Record<string, string>;
  extensions?: string[];
}

export type LspEntry = { disabled: true } | {
  command: string[];
  extensions?: string[];
  disabled?: boolean;
  env?: Record<string, string>;
  initialization?: Record<string, unknown>;
};

export interface TuiConfig {
  scroll_speed?: number;
  scroll_acceleration?: { enabled: boolean };
  diff_style?: 'auto' | 'stacked';
}

export interface ExperimentalConfig {
  hook?: {
    file_edited?: Record<string, HookCommand[]>;
    session_completed?: HookCommand[];
  };
  disable_paste_summary?: boolean;
  batch_tool?: boolean;
  openTelemetry?: boolean;
  continue_loop_on_deny?: boolean;
  chatMaxRetries?: number;
  mcp_timeout?: number;
  primary_tools?: string[];
  policies?: ExperimentalPolicy[];
}

export interface HookCommand {
  command: string[];
  environment?: Record<string, string>;
}

export interface ExperimentalPolicy {
  action: 'provider.use';
  effect: 'allow' | 'deny';
  resource: string;
}

// ============================================================
// 配置摘要
// ============================================================
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
