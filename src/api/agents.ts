/**
 * 代理 API 封装
 */

import { get, post, put, del } from './client';
import type { AgentConfig } from '../types/config';

/** 代理信息 */
export interface AgentInfo {
  name: string;
  filePath: string;
  config: AgentConfig;
  fileFrontmatter: Record<string, unknown>;
  fileContent: string;
}

/** 代理列表响应 */
interface AgentsListResponse {
  agents: AgentInfo[];
}

/** 文件内容响应 */
interface FileResponse {
  frontmatter: Record<string, unknown>;
  content: string;
  filePath: string;
}

/** 获取所有代理 */
export function fetchAgents(): Promise<AgentsListResponse> {
  return get<AgentsListResponse>('/agents');
}

/** 创建代理 */
export function createAgent(
  name: string,
  config: AgentConfig,
  prompt?: string,
): Promise<{ agent: AgentInfo }> {
  return post<{ agent: AgentInfo }>('/agents', { name, config, prompt });
}

/** 更新代理 */
export function updateAgent(
  name: string,
  config: Partial<AgentConfig>,
  prompt?: string,
  frontmatter?: Record<string, unknown>,
): Promise<{ agent: AgentInfo }> {
  return put<{ agent: AgentInfo }>(`/agents/${encodeURIComponent(name)}`, { config, prompt, frontmatter });
}

/** 删除代理 */
export function deleteAgent(name: string): Promise<void> {
  return del<void>(`/agents/${encodeURIComponent(name)}`);
}

/** 读取代理 .md 文件 */
export function readAgentFile(name: string): Promise<FileResponse> {
  return get<FileResponse>(`/agents/files/${encodeURIComponent(name)}`);
}

/** 写入代理 .md 文件 */
export function writeAgentFile(
  name: string,
  content: string,
  frontmatter?: Record<string, unknown>,
): Promise<FileResponse> {
  return put<FileResponse>(`/agents/files/${encodeURIComponent(name)}`, { content, frontmatter });
}
