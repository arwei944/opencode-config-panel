/**
 * 前端 UI 状态类型定义
 */

/** 导航区域标识 */
export type NavSection =
  | '仪表盘'
  | '提供商管理'
  | '代理管理'
  | '工具管理'
  | '技能管理'
  | 'MCP 服务器'
  | '插件管理'
  | '权限配置'
  | '快捷键绑定'
  | '自定义命令'
  | '事件钩子'
  | '指令文件'
  | '高级设置'
  | 'JSON 编辑器';

/** 导航项定义 */
export interface NavItem {
  id: NavSection;
  label: string;
  icon: string;
  path: string;
  badge?: number | string;
}

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
