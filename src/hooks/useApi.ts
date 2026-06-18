import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * 通用 API 调用 Hook
 * 管理 loading、data、error 三种状态
 */

interface UseApiState<T> {
  /** 响应数据 */
  data: T | null;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
}

interface UseApiReturn<T> extends UseApiState<T> {
  /** 执行 API 调用 */
  execute: (...args: unknown[]) => Promise<T | null>;
  /** 重置状态 */
  reset: () => void;
  /** 手动设置数据 */
  setData: (data: T | null) => void;
}

/**
 * 通用的 API 调用 Hook
 * @param apiFunction API 调用函数
 * @param immediate 是否立即执行
 */
export function useApi<T>(
  apiFunction: (...args: unknown[]) => Promise<T>,
  immediate = false,
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: immediate,
    error: null,
  });

  const mountedRef = useRef(true);
  const apiFnRef = useRef(apiFunction);

  // 同步引用
  apiFnRef.current = apiFunction;

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(async (...args: unknown[]): Promise<T | null> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await apiFnRef.current(...args);
      if (mountedRef.current) {
        setState({ data: result, loading: false, error: null });
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      if (mountedRef.current) {
        setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      }
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  const setData = useCallback((data: T | null) => {
    setState(prev => ({ ...prev, data }));
  }, []);

  return {
    ...state,
    execute,
    reset,
    setData,
  };
}
