/**
 * 提供商 API 封装
 */

import { get, post, put, del } from './client';
import type { ApiResponse } from '../types/api';
import type { ProviderConfig, ModelConfig } from '../types/config';

/** 提供商列表响应 */
interface ProvidersListResponse {
  providers: Record<string, ProviderConfig>;
}

/** 提供商详情响应 */
interface ProviderResponse {
  provider: ProviderConfig;
}

/** 模型列表响应 */
interface ModelsResponse {
  models: Record<string, ModelConfig>;
}

/** 模型详情响应 */
interface ModelResponse {
  model: ModelConfig;
}

/** 连接测试响应 */
interface TestConnectionResponse {
  reachable: boolean;
  latencyMs: number;
  modelsFetched: number;
  error: string | null;
}

/** 获取所有提供商 */
export function fetchProviders(): Promise<ProvidersListResponse> {
  return get<ProvidersListResponse>('/providers');
}

/** 添加提供商 */
export function createProvider(name: string, config: ProviderConfig): Promise<ProviderResponse> {
  return post<ProviderResponse>('/providers', { name, config });
}

/** 更新提供商 */
export function updateProvider(name: string, config: Partial<ProviderConfig>): Promise<ProviderResponse> {
  return put<ProviderResponse>(`/providers/${encodeURIComponent(name)}`, config);
}

/** 删除提供商 */
export function deleteProvider(name: string): Promise<ApiResponse> {
  return del<ApiResponse>(`/providers/${encodeURIComponent(name)}`);
}

/** 测试连接 */
export function testProviderConnection(
  name: string,
  options?: { baseURL: string; apiKey?: string },
): Promise<TestConnectionResponse> {
  return post<TestConnectionResponse>(`/providers/${encodeURIComponent(name)}/test`, { options });
}

/** 获取模型列表 */
export function fetchModels(providerName: string): Promise<ModelsResponse> {
  return get<ModelsResponse>(`/providers/${encodeURIComponent(providerName)}/models`);
}

/** 添加模型 */
export function createModel(
  providerName: string,
  key: string,
  config: ModelConfig,
): Promise<ModelResponse> {
  return post<ModelResponse>(`/providers/${encodeURIComponent(providerName)}/models`, { key, config });
}

/** 批量更新模型 */
export function batchUpdateModels(
  providerName: string,
  models: Record<string, ModelConfig>,
): Promise<ModelsResponse> {
  return put<ModelsResponse>(`/providers/${encodeURIComponent(providerName)}/models`, { models });
}

/** 删除模型 */
export function deleteModel(providerName: string, modelKey: string): Promise<ApiResponse> {
  return del<ApiResponse>(
    `/providers/${encodeURIComponent(providerName)}/models/${encodeURIComponent(modelKey)}`,
  );
}
