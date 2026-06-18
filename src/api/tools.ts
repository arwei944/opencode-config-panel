/**
 * 工具 API 封装
 */

import { get, put, post } from './client';

/** 工具信息 */
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

/** 工具列表响应 */
interface ToolsListResponse {
  tools: ToolInfo[];
  globalToolSettings: Record<string, boolean>;
  primaryTools: string[];
}

/** 获取所有工具及状态 */
export function fetchTools(): Promise<ToolsListResponse> {
  return get<ToolsListResponse>('/tools');
}

/** 批量更新全局工具开关 */
export function updateGlobalTools(tools: Record<string, boolean>): Promise<{ tools: Record<string, boolean> }> {
  return put<{ tools: Record<string, boolean> }>('/tools', { tools });
}

/** 更新代理工具覆盖 */
export function updateAgentToolOverrides(
  agentName: string,
  tools: Record<string, boolean>,
): Promise<{ tools: Record<string, boolean> }> {
  return put<{ tools: Record<string, boolean> }>(`/tools/agent/${encodeURIComponent(agentName)}`, { tools });
}

/** 重置代理工具覆盖 */
export function resetAgentToolOverrides(agentName: string): Promise<void> {
  return post<void>(`/tools/agent/${encodeURIComponent(agentName)}/reset`);
}

/** 更新主代理专属工具 */
export function updatePrimaryTools(primaryTools: string[]): Promise<{ primaryTools: string[] }> {
  return put<{ primaryTools: string[] }>('/tools/primary', { primaryTools });
}
