/**
 * ============================================================
 * 原子：MCP（Model Context Protocol）
 * 描述：MCP 服务器配置类型定义（最小不可变单元）
 * 约束：本原子不可修改，所有变更应通过 Port 接口进行
 * ============================================================
 */

/** 本地 MCP 服务器配置原子 */
export interface McpLocalConfig {
  type?: 'local';
  command: string[];
  environment?: Record<string, string>;
  enabled?: boolean;
  timeout?: number;
}

/** 远程 MCP 服务器配置原子 */
export interface McpRemoteConfig {
  type?: 'remote';
  url: string;
  headers?: Record<string, string>;
  oauth?: McpOAuthConfig | false;
  enabled?: boolean;
}

/** 简单 MCP 开关配置原子 */
export interface McpSimpleConfig {
  enabled: boolean;
}

/** MCP OAuth 配置原子 */
export interface McpOAuthConfig {
  authorization_url: string;
  token_url: string;
  client_id: string;
  client_secret?: string;
  scopes?: string[];
}

/** MCP 服务器联合类型 */
export type McpConfig = McpLocalConfig | McpRemoteConfig | McpSimpleConfig;
