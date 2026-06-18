/**
 * 事件钩子 API 封装
 */

import { get, put, post, del } from './client';
import type { HooksConfig } from '../types/api';

/** 获取钩子配置 */
export function fetchHooks(): Promise<HooksConfig> {
  return get<HooksConfig>('/hooks');
}

/** 全量替换钩子配置 */
export function replaceHooks(data: HooksConfig): Promise<HooksConfig> {
  return put<HooksConfig>('/hooks', data);
}

/** 添加文件编辑钩子命令组 */
export function addFileEditedHook(
  extensions: string,
  commands: { command: string[]; environment?: Record<string, string> }[],
): Promise<{ file_edited: Record<string, unknown> }> {
  return post<{ file_edited: Record<string, unknown> }>('/hooks/file-edited', { extensions, commands });
}

/** 删除扩展名组 */
export function deleteFileEditedHook(extensions: string): Promise<void> {
  return del<void>(`/hooks/file-edited/${encodeURIComponent(extensions)}`);
}

/** 添加会话完成钩子命令 */
export function addSessionCompletedHook(
  command: string[],
  environment?: Record<string, string>,
): Promise<{ session_completed: unknown[] }> {
  return post<{ session_completed: unknown[] }>('/hooks/session-completed', { command, environment });
}

/** 删除指定索引的会话完成钩子 */
export function deleteSessionCompletedHook(index: number): Promise<{ session_completed: unknown[] }> {
  return del<{ session_completed: unknown[] }>(`/hooks/session-completed/${index}`);
}
