/**
 * 连接测试服务
 * 向提供商 API 发送请求，测试可达性并获取可用模型
 */

import { AppError } from '../middleware/errorHandler';

export interface TestConnectionResult {
  reachable: boolean;
  latencyMs: number;
  modelsFetched: number;
  error: string | null;
}

interface TestConnectionOptions {
  baseURL: string;
  apiKey?: string;
  timeout?: number;
}

/**
 * 测试与 AI 提供商的连接
 * 发送 GET 请求到 {baseURL}/models 或根路径检测可达性
 */
export async function testConnection(options: TestConnectionOptions): Promise<TestConnectionResult> {
  const { baseURL, apiKey, timeout = 10000 } = options;

  if (!baseURL) {
    throw new AppError(400, 'VALIDATION_ERROR', '请提供 baseURL');
  }

  let url: URL;
  try {
    url = new URL(baseURL);
  } catch {
    throw new AppError(400, 'VALIDATION_ERROR', 'baseURL 格式不正确');
  }

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // 先尝试访问 /v1/models 端点（OpenAI 兼容）
    const modelsUrl = `${url.origin}/v1/models`;
    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      // 如果 /v1/models 不可用，尝试访问根路径
      const rootResponse = await fetch(url.origin, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(timeout),
      });
      const rootLatency = Date.now() - startTime;

      return {
        reachable: rootResponse.ok,
        latencyMs: rootLatency,
        modelsFetched: 0,
        error: rootResponse.ok ? null : `服务返回 ${rootResponse.status}`,
      };
    }

    // 解析模型列表
    const body = await response.json();
    const models = body.data || body.models || [];
    const modelCount = Array.isArray(models) ? models.length : 0;

    return {
      reachable: true,
      latencyMs,
      modelsFetched: modelCount,
      error: null,
    };
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        reachable: false,
        latencyMs: timeout,
        modelsFetched: 0,
        error: '连接超时',
      };
    }

    return {
      reachable: false,
      latencyMs: Date.now() - startTime,
      modelsFetched: 0,
      error: `连接失败: ${(err as Error).message}`,
    };
  }
}
