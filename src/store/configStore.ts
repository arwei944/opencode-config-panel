/**
 * 配置状态管理 Store
 * 管理配置的加载、更新和缓存状态
 */

import { useState, useCallback } from 'react';
import { get, patch } from '../api/client';
import type { ConfigResponse } from '../types/api';
import type { OpenCodeConfig } from '../types/config';

interface ConfigStoreState {
  /** 完整配置 */
  config: OpenCodeConfig | null;
  /** 配置摘要 */
  summary: ConfigResponse['summary'] | null;
  /** 加载状态 */
  loading: boolean;
  /** 保存状态 */
  saving: boolean;
  /** 错误信息 */
  error: string | null;
  /** 最后加载时间 */
  lastLoaded: Date | null;
}

interface ConfigStoreReturn extends ConfigStoreState {
  /** 加载配置 */
  loadConfig: () => Promise<void>;
  /** 更新配置（部分合并） */
  updateConfig: (partial: Partial<OpenCodeConfig>) => Promise<void>;
  /** 清除错误 */
  clearError: () => void;
}

/**
 * 配置状态管理 Hook
 * 全局唯一的配置状态
 */
export function useConfigStore(): ConfigStoreReturn {
  const [state, setState] = useState<ConfigStoreState>({
    config: null,
    summary: null,
    loading: false,
    saving: false,
    error: null,
    lastLoaded: null,
  });

  const loadConfig = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await get<ConfigResponse>('/config');
      setState({
        config: data.config,
        summary: data.summary,
        loading: false,
        saving: false,
        error: null,
        lastLoaded: new Date(),
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : '加载配置失败',
      }));
    }
  }, []);

  const updateConfig = useCallback(async (partial: Partial<OpenCodeConfig>) => {
    setState(prev => ({ ...prev, saving: true, error: null }));
    try {
      const data = await patch<ConfigResponse>('/config', partial);
      setState(prev => ({
        ...prev,
        config: data.config,
        summary: data.summary,
        saving: false,
        error: null,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        saving: false,
        error: err instanceof Error ? err.message : '更新配置失败',
      }));
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return { ...state, loadConfig, updateConfig, clearError };
}
