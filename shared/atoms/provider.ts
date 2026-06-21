/**
 * ============================================================
 * 原子：Provider / Model
 * 描述：AI 提供商与模型的类型定义（最小不可变单元）
 * 约束：本原子不可修改，所有变更应通过 Port 接口进行
 * ============================================================
 */

/** 提供商配置原子 */
export interface ProviderConfig {
  /** 提供商类型（openai/anthropic/google 等） */
  type?: string;
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

/** 模型配置原子 */
export interface ModelConfig {
  id: string;
  name?: string;
  /** 上下文窗口大小（已废弃，使用 limit.context） */
  context?: number;
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

/** 连接测试结果原子 */
export interface TestConnectionResult {
  reachable: boolean;
  latencyMs: number;
  modelsFetched: number;
  error: string | null;
}

/** 连接测试参数原子 */
export interface TestConnectionParams {
  baseURL: string;
  apiKey?: string;
  timeout?: number;
}

/** 智能探测结果原子 */
export interface DetectResult {
  name: string;
  type: string;
  models: Record<string, ModelConfig>;
}

/** 智能添加结果原子 */
export interface SmartAddResult {
  name: string;
  config: ProviderConfig;
}
