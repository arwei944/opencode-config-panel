/**
 * ============================================================
 * 原子：Nav（导航）
 * 描述：导航配置类型定义（最小不可变单元）
 * 约束：本原子不可修改，所有变更应通过 Port 接口进行
 * ============================================================
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

/** 导航项原子 */
export interface NavItem {
  id: NavSection;
  label: string;
  icon: string;
  path: string;
  badge?: number | string;
}

/** 导航分组原子 */
export interface NavSectionGroup {
  title: string;
  items: NavSection[];
}

/** 应用配置原子 */
export interface AppConfig {
  name: string;
  version: string;
  repo: string;
}
