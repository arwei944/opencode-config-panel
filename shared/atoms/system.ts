/**
 * ============================================================
 * 原子：System（系统配置）
 * 描述：命令、服务器、技能源、引用等系统级类型定义
 * 约束：本原子不可修改，所有变更应通过 Port 接口进行
 * ============================================================
 */

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
// 技能源
// ============================================================
export interface SkillSourcesConfig {
  paths?: string[];
  urls?: string[];
}

// ============================================================
// 引用
// ============================================================
export type ReferenceConfigEntry = string | {
  repository: string;
  branch?: string;
} | {
  path: string;
};

// ============================================================
// 附件
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
// 工具输出
// ============================================================
export interface ToolOutputConfig {
  max_lines?: number;
  max_bytes?: number;
}

// ============================================================
// 压缩
// ============================================================
export interface CompactionConfig {
  auto?: boolean;
  prune?: boolean;
  tail_turns?: number;
  preserve_recent_tokens?: number;
  reserved?: number;
}

// ============================================================
// 格式化/LSP/TUI
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
// 实验性功能
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
