/**
 * ============================================================
 * 原子：Agent
 * 描述：代理配置的类型定义（最小不可变单元）
 * 约束：本原子不可修改，所有变更应通过 Port 接口进行
 * ============================================================
 */

import type { PermissionConfig } from './permission';

/** 代理配置原子 */
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

/** 代理信息原子（含文件元数据） */
export interface AgentInfo {
  name: string;
  filePath: string;
  config: AgentConfig;
  fileFrontmatter: Record<string, unknown>;
  fileContent: string;
}
