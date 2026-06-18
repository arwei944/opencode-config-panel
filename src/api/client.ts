/**
 * API 客户端封装
 * 基于 fetch 的统一请求工具，包含错误处理和类型泛型支持
 */

/** API 基础路径 */
const BASE_URL = '/api';

/** 通用 API 响应格式 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

/** 请求选项扩展 */
interface RequestOptions extends RequestInit {
  /** 超时时间（毫秒） */
  timeout?: number;
}

/** API 错误类 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * 发送 API 请求
 * @param path 请求路径（相对 /api）
 * @param options 请求选项
 * @returns 解析后的响应数据
 */
export async function request<T>(
  path: string,
  options: RequestOptions = {},
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
      throw new ApiError(
        response.status,
        result.code || 'UNKNOWN_ERROR',
        result.error || '请求失败',
      );
    }

    return result.data as T;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(408, 'TIMEOUT', '请求超时');
    }

    if (error instanceof TypeError) {
      throw new ApiError(0, 'NETWORK_ERROR', '网络连接失败，请确保后端服务已启动');
    }

    throw new ApiError(500, 'UNKNOWN_ERROR', '未知错误');
  }
}

/**
 * GET 请求
 */
export function get<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>(path, { ...options, method: 'GET' });
}

/**
 * POST 请求
 */
export function post<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  return request<T>(path, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PUT 请求
 */
export function put<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  return request<T>(path, {
    ...options,
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PATCH 请求
 */
export function patch<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  return request<T>(path, {
    ...options,
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE 请求
 */
export function del<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>(path, { ...options, method: 'DELETE' });
}
