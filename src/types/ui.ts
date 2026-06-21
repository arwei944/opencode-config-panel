/**
 * ============================================================
 * 前端 UI 状态类型定义
 * 兼容层：从原子层导入 + 本地特有类型
 * ============================================================
 */

import type { NavSection } from '@shared/atoms';

/** 主题模式 */
export type ThemeMode = 'light' | 'dark' | 'system';

/** 侧边栏状态 */
export interface SidebarState {
  collapsed: boolean;
  activeSection: NavSection | null;
}

/** 通知消息 */
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  createdAt: number;
}

/** 模态框配置 */
export interface ModalConfig {
  open: boolean;
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

/** 分页状态 */
export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

/** 排序配置 */
export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

// 从原子层重新导出
export type { NavSection, NavItem } from '@shared/atoms';
