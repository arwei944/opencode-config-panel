/**
 * ============================================================
 * 适配器：ApiAdapter
 * 描述：前端 API 适配器 — 将 HTTP 请求封装为类型安全的服务调用
 * 依赖方向：React 组件 → 本适配器 → fetch
 * ============================================================
 */

import type {
  OpenCodeConfig,
  ConfigSummary,
  ProviderConfig,
  AgentConfig,
  AgentInfo,
  SkillInfo,
  SkillScanResult,
  McpConfig,
  BackupInfo,
  BackupCreateResult,
  TestConnectionResult,
  DetectResult,
  ModelConfig,
} from '@shared/atoms';

import type {
  ApiResponse,
  ConfigResponse,
  ExportResult,
  ValidateResult,
  ToolsResponse,
  HooksConfig,
} from '../types/api';

// ============================================================
// API 基础客户端（内部使用）
// ============================================================

const BASE_URL = '/api';

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { timeout?: number } = {},
): Promise<T> {
  const { timeout = 30000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
    });
    clearTimeout(timeoutId);
    const result: ApiResponse<T> = await response.json();
    if (!result.success) {
      throw new ApiError(response.status, result.code || 'UNKNOWN_ERROR', result.error || '请求失败');
    }
    return result.data as T;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(408, 'TIMEOUT', '请求超时');
    }
    if (error instanceof TypeError) {
      throw new ApiError(0, 'NETWORK_ERROR', '网络连接失败，请确保后端服务已启动');
    }
    throw new ApiError(500, 'UNKNOWN_ERROR', '未知错误');
  }
}

function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
}

function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
}

function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
}

function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}

// ============================================================
// ApiAdapter — 统一前端 API 入口
// 使用方式：ApiAdapter.config.get()、ApiAdapter.providers.list() 等
// ============================================================

export const ApiAdapter = {
  /** 配置管理 */
  config: {
    get: (): Promise<ConfigResponse> => get<ConfigResponse>('/config'),
    getSummary: (): Promise<ConfigSummary> => get<ConfigSummary>('/config/summary'),
    replace: (config: OpenCodeConfig): Promise<{ config: OpenCodeConfig }> =>
      put<{ config: OpenCodeConfig }>('/config', config),
    update: (partial: Partial<OpenCodeConfig>): Promise<{ config: OpenCodeConfig }> =>
      patch<{ config: OpenCodeConfig }>('/config', partial),
    validate: (config: OpenCodeConfig): Promise<ValidateResult> =>
      post<ValidateResult>('/config/validate', { config }),
    export_: (): Promise<ExportResult> => get<ExportResult>('/config/export'),
    import_: (config: OpenCodeConfig): Promise<{ config: OpenCodeConfig }> =>
      post<{ config: OpenCodeConfig }>('/config/import', { config }),
  },

  /** 备份管理 */
  backups: {
    list: (): Promise<{ backups: BackupInfo[] }> => get<{ backups: BackupInfo[] }>('/backups'),
    create: (): Promise<BackupCreateResult> => post<BackupCreateResult>('/config/backup'),
    get: (id: string): Promise<{ config: OpenCodeConfig }> =>
      get<{ config: OpenCodeConfig }>(`/config/backup/${encodeURIComponent(id)}`),
    restore: (id: string): Promise<{ config: OpenCodeConfig }> =>
      post<{ config: OpenCodeConfig }>(`/config/backup/${encodeURIComponent(id)}/restore`),
    delete: (id: string): Promise<void> =>
      del<void>(`/config/backup/${encodeURIComponent(id)}`),
  },

  /** 提供商管理 */
  providers: {
    list: (): Promise<{ providers: Record<string, ProviderConfig> }> =>
      get<{ providers: Record<string, ProviderConfig> }>('/providers'),
    get: (name: string): Promise<ProviderConfig | undefined> =>
      get<{ providers: Record<string, ProviderConfig> }>('/providers').then(r => r.providers[name]),
    create: (name: string, config: ProviderConfig): Promise<{ provider: ProviderConfig }> =>
      post<{ provider: ProviderConfig }>('/providers', { name, config }),
    update: (name: string, config: Partial<ProviderConfig>): Promise<{ provider: ProviderConfig }> =>
      put<{ provider: ProviderConfig }>(`/providers/${encodeURIComponent(name)}`, config),
    delete: (name: string): Promise<void> =>
      del<void>(`/providers/${encodeURIComponent(name)}`),
    detect: (baseURL: string, apiKey?: string): Promise<DetectResult> =>
      post<DetectResult>('/providers/detect', { baseURL, apiKey }),
    smartAdd: (baseURL: string, apiKey?: string): Promise<{ name: string; config: ProviderConfig }> =>
      post<{ name: string; config: ProviderConfig }>('/providers/smart-add', { baseURL, apiKey }),
    testConnection: (name: string): Promise<TestConnectionResult> =>
      post<TestConnectionResult>(`/providers/${encodeURIComponent(name)}/test`, {}),
    // 模型管理
    models: {
      list: (providerName: string): Promise<{ models: Record<string, ModelConfig> }> =>
        get<{ models: Record<string, ModelConfig> }>(`/providers/${encodeURIComponent(providerName)}/models`),
      create: (providerName: string, key: string, config: ModelConfig): Promise<{ model: ModelConfig }> =>
        post<{ model: ModelConfig }>(`/providers/${encodeURIComponent(providerName)}/models`, { key, config }),
      batchUpdate: (providerName: string, models: Record<string, ModelConfig>): Promise<{ models: Record<string, ModelConfig> }> =>
        put<{ models: Record<string, ModelConfig> }>(`/providers/${encodeURIComponent(providerName)}/models`, { models }),
      delete: (providerName: string, modelKey: string): Promise<void> =>
        del<void>(`/providers/${encodeURIComponent(providerName)}/models/${encodeURIComponent(modelKey)}`),
    },
  },

  /** 代理管理 */
  agents: {
    list: (): Promise<{ agents: AgentInfo[] }> => get<{ agents: AgentInfo[] }>('/agents'),
    create: (name: string, config: AgentConfig, prompt?: string): Promise<{ agent: AgentInfo }> =>
      post<{ agent: AgentInfo }>('/agents', { name, config, prompt }),
    update: (name: string, config: Partial<AgentConfig>, prompt?: string, frontmatter?: Record<string, unknown>): Promise<{ agent: AgentInfo }> =>
      put<{ agent: AgentInfo }>(`/agents/${encodeURIComponent(name)}`, { config, prompt, frontmatter }),
    delete: (name: string): Promise<void> => del<void>(`/agents/${encodeURIComponent(name)}`),
    readFile: (name: string): Promise<{ frontmatter: Record<string, unknown>; content: string; filePath: string }> =>
      get<{ frontmatter: Record<string, unknown>; content: string; filePath: string }>(`/agents/files/${encodeURIComponent(name)}`),
    writeFile: (name: string, frontmatter: Record<string, unknown>, content: string): Promise<{ frontmatter: Record<string, unknown>; content: string; filePath: string }> =>
      put<{ frontmatter: Record<string, unknown>; content: string; filePath: string }>(`/agents/files/${encodeURIComponent(name)}`, { frontmatter, content }),
  },

  /** 工具管理 */
  tools: {
    list: (): Promise<ToolsResponse> => get<ToolsResponse>('/tools'),
    updateGlobal: (tools: Record<string, boolean>): Promise<{ tools: Record<string, boolean> }> =>
      put<{ tools: Record<string, boolean> }>('/tools', { tools }),
    updateAgentOverrides: (agentName: string, tools: Record<string, boolean>): Promise<{ tools: Record<string, boolean> }> =>
      put<{ tools: Record<string, boolean> }>(`/tools/agent/${encodeURIComponent(agentName)}`, { tools }),
    resetAgentOverrides: (agentName: string): Promise<void> =>
      post<void>(`/tools/agent/${encodeURIComponent(agentName)}/reset`),
    updatePrimaryTools: (primaryTools: string[]): Promise<{ primaryTools: string[] }> =>
      put<{ primaryTools: string[] }>('/tools/primary', { primaryTools }),
  },

  /** 技能管理 */
  skills: {
    list: (): Promise<SkillScanResult> => get<SkillScanResult>('/skills'),
    create: (data: {
      name: string; description?: string; license?: string;
      severity?: string; persistence?: string; content?: string;
    }): Promise<{ skill: SkillInfo }> => post<{ skill: SkillInfo }>('/skills', data),
    update: (name: string, data: Partial<Omit<SkillInfo, 'name' | 'filePath' | 'enabled'>>): Promise<{ skill: SkillInfo }> =>
      put<{ skill: SkillInfo }>(`/skills/${encodeURIComponent(name)}`, data),
    delete: (name: string): Promise<void> => del<void>(`/skills/${encodeURIComponent(name)}`),
    setPermission: (name: string, permission: string): Promise<void> =>
      put<void>(`/skills/${encodeURIComponent(name)}/permission`, { permission }),
    rescan: (): Promise<SkillScanResult> => post<SkillScanResult>('/skills/rescan'),
    readFile: (name: string): Promise<{ frontmatter: Record<string, unknown>; content: string }> =>
      get<{ frontmatter: Record<string, unknown>; content: string }>(`/skills/files/${encodeURIComponent(name)}`),
    writeFile: (name: string, frontmatter: Record<string, unknown>, content: string): Promise<void> =>
      put<void>(`/skills/files/${encodeURIComponent(name)}`, { frontmatter, content }),
  },

  /** MCP 服务器管理 */
  mcp: {
    list: (): Promise<{ servers: Record<string, McpConfig> }> =>
      get<{ servers: Record<string, McpConfig> }>('/mcp'),
    create: (name: string, config: McpConfig): Promise<{ server: McpConfig }> =>
      post<{ server: McpConfig }>('/mcp', { name, config }),
    update: (name: string, config: Partial<McpConfig>): Promise<{ server: McpConfig }> =>
      put<{ server: McpConfig }>(`/mcp/${encodeURIComponent(name)}`, config),
    delete: (name: string): Promise<void> => del<void>(`/mcp/${encodeURIComponent(name)}`),
  },

  /** 事件钩子管理 */
  hooks: {
    get: (): Promise<HooksConfig> => get<HooksConfig>('/hooks'),
    replace: (data: HooksConfig): Promise<{ hooks: HooksConfig }> =>
      put<{ hooks: HooksConfig }>('/hooks', data),
    addFileEdited: (extensions: string, commands: { command: string[]; environment?: Record<string, string> }[]): Promise<{ file_edited: Record<string, unknown> }> =>
      post<{ file_edited: Record<string, unknown> }>('/hooks/file-edited', { extensions, commands }),
    deleteFileEdited: (extensions: string): Promise<void> =>
      del<void>(`/hooks/file-edited/${encodeURIComponent(extensions)}`),
    addSessionCompleted: (command: { command: string[]; environment?: Record<string, string> }): Promise<{ session_completed: unknown[] }> =>
      post<{ session_completed: unknown[] }>('/hooks/session-completed', command),
    deleteSessionCompleted: (index: number): Promise<{ session_completed: unknown[] }> =>
      del<{ session_completed: unknown[] }>(`/hooks/session-completed/${index}`),
  },
};

export { ApiError };
