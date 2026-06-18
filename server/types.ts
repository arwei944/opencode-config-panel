/**
 * 后端类型定义
 * 对应 opencode.json 完整配置结构及 API 响应类型
 */

// ============================================================
// 1. 顶级配置（对应 opencode.json）
// ============================================================
export interface OpenCodeConfig {
  $schema?: string;
  theme?: string;
  logLevel?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  shell?: string;
  default_agent?: string;
  username?: string;

  // 模型
  model?: string;
  small_model?: string;

  // 提供商
  provider?: Record<string, ProviderConfig>;

  // 代理
  agent?: Record<string, AgentConfig>;

  // MCP 服务器
  mcp?: Record<string, McpLocalConfig | McpRemoteConfig | McpSimpleConfig>;

  // 工具
  tools?: Record<string, boolean>;

  // 权限
  permission?: PermissionConfig;

  // 快捷键
  keybinds?: Record<string, string>;

  // 指令
  instructions?: string[];

  // 命令
  command?: Record<string, CommandConfig>;

  // 服务器
  server?: ServerConfig;

  // 技能
  skills?: SkillSourcesConfig;

  // 引用
  reference?: Record<string, ReferenceConfigEntry>;

  // 附件
  attachment?: AttachmentConfig;

  // 工具输出
  tool_output?: ToolOutputConfig;

  // 压缩
  compaction?: CompactionConfig;

  // 格式化
  formatter?: Record<string, FormatterEntry> | false;

  // LSP
  lsp?: Record<string, LspEntry> | false;

  // 文件监控
  watcher?: { ignore?: string[] };

  // UI
  tui?: TuiConfig;

  // 插件
  plugin?: (string | [string, Record<string, unknown>])[];

  // 快照/共享
  snapshot?: boolean;
  share?: 'manual' | 'auto' | 'disabled';
  autoshare?: boolean;
  autoupdate?: boolean | 'notify';

  // 提供商过滤
  disabled_providers?: string[];
  enabled_providers?: string[];

  // 企业版
  enterprise?: { url?: string };

  // 布局（已废弃）
  layout?: 'auto' | 'stretch';

  // 实验性
  experimental?: ExperimentalConfig;

  // 已废弃
  mode?: Record<string, AgentConfig>;
}

// ============================================================
// 2. 提供商配置
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
// 3. 代理配置
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
// 4. MCP 服务器配置
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
// 5. 权限配置
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
// 6. 命令配置
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
// 7. 服务器配置
// ============================================================
export interface ServerConfig {
  port?: number;
  hostname?: string;
  mdns?: boolean;
  mdnsDomain?: string;
  cors?: string[];
}

// ============================================================
// 8. 技能源配置
// ============================================================
export interface SkillSourcesConfig {
  paths?: string[];
  urls?: string[];
}

// ============================================================
// 9. 引用配置
// ============================================================
export type ReferenceConfigEntry = string | {
  repository: string;
  branch?: string;
} | {
  path: string;
};

// ============================================================
// 10. 附件配置
// ============================================================
export interface AttachmentConfig {
  image?: {
    auto_resize?: boolean;
    max_width?: number;
    max_height?: number;
    max_base64_bytes?: number;
  };
}

// ============================================================
// 11. 工具输出配置
// ============================================================
export interface ToolOutputConfig {
  max_lines?: number;
  max_bytes?: number;
}

// ============================================================
// 12. 压缩配置
// ============================================================
export interface CompactionConfig {
  auto?: boolean;
  prune?: boolean;
  tail_turns?: number;
  preserve_recent_tokens?: number;
  reserved?: number;
}

// ============================================================
// 13. 格式化/LSP/TUI 配置
// ============================================================
export interface FormatterEntry {
  disabled?: boolean;
  command?: string[];
  environment?: Record<string, string>;
  extensions?: string[];
}

export type LspEntry = {
  disabled: true;
} | {
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

// ============================================================
// 14. 实验性配置
// ============================================================
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
// 15. 文件相关类型
// ============================================================
export interface MarkdownFile {
  frontmatter: Record<string, unknown>;
  content: string;
  filePath: string;
}

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

export interface ToolInfo {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  builtin: boolean;
  source?: string;
  enabled: boolean;
  agentOverrides: Record<string, boolean | null>;
}

export type ToolCategory = '文件操作' | '执行工具' | '网络工具' | '代理工具' | '工具链' | '自定义';

// ============================================================
// 16. API 响应类型
// ============================================================
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

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

export interface BackupInfo {
  id: string;
  /** 备份文件名 */
  filename: string;
  timestamp: string;
  size: number;
  path: string;
}

// ============================================================
// 17. 前端 UI 类型
// ============================================================
export type NavSection =
  | '仪表盘'
  | '提供商管理'
  | '代理管理'
  | '工具管理'
  | '技能管理'
  | 'MCP 服务器'
  | '插件管理'
  | '权限配置'
  | '快捷键绑定'
  | '自定义命令'
  | '事件钩子'
  | '指令文件'
  | '高级设置'
  | 'JSON 编辑器';

export interface NavItem {
  id: NavSection;
  label: string;
  icon: string;
  path: string;
  badge?: number | string;
}
