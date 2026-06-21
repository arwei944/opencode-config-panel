/**
 * ============================================================
 * 常量定义（原子层）
 * 导航项配置、默认值等
 * 原子不可变：所有导出常量均为只读
 * ============================================================
 */

import type { NavItem, NavSectionGroup, AppConfig } from '@shared/atoms';
import type { NavSection } from '@shared/atoms';

/** 全部导航定义（原子 — 不可变） */
export const NAV_ITEMS: readonly NavItem[] = Object.freeze([
  Object.freeze({ id: '仪表盘' as NavSection, label: '仪表盘', icon: 'dashboard', path: '/dashboard' }),
  Object.freeze({ id: '提供商管理' as NavSection, label: '提供商管理', icon: 'cloud', path: '/providers' }),
  Object.freeze({ id: '代理管理' as NavSection, label: '代理管理', icon: 'smart_toy', path: '/agents' }),
  Object.freeze({ id: '工具管理' as NavSection, label: '工具管理', icon: 'construction', path: '/tools' }),
  Object.freeze({ id: '技能管理' as NavSection, label: '技能管理', icon: 'psychology', path: '/skills' }),
  Object.freeze({ id: 'MCP 服务器' as NavSection, label: 'MCP 服务器', icon: 'dns', path: '/mcp' }),
  Object.freeze({ id: '事件钩子' as NavSection, label: '事件钩子', icon: 'sync', path: '/hooks' }),
  Object.freeze({ id: '插件管理' as NavSection, label: '插件管理', icon: 'extension', path: '/plugins' }),
  Object.freeze({ id: '权限配置' as NavSection, label: '权限配置', icon: 'lock', path: '/permissions' }),
  Object.freeze({ id: '快捷键绑定' as NavSection, label: '快捷键绑定', icon: 'keyboard', path: '/keybinds' }),
  Object.freeze({ id: '自定义命令' as NavSection, label: '自定义命令', icon: 'terminal', path: '/commands' }),
  Object.freeze({ id: '指令文件' as NavSection, label: '指令文件', icon: 'description', path: '/instructions' }),
  Object.freeze({ id: '高级设置' as NavSection, label: '高级设置', icon: 'settings', path: '/advanced' }),
  Object.freeze({ id: 'JSON 编辑器' as NavSection, label: 'JSON 编辑器', icon: 'code', path: '/raw' }),
]);

/** 导航分组配置（原子 — 不可变） */
export const NAV_SECTIONS: readonly NavSectionGroup[] = [
  { title: '概览', items: ['仪表盘' as NavSection] },
  { title: '配置管理', items: ['提供商管理' as NavSection, '代理管理' as NavSection, '工具管理' as NavSection, '技能管理' as NavSection, 'MCP 服务器' as NavSection] },
  { title: '扩展', items: ['事件钩子' as NavSection, '插件管理' as NavSection] },
  { title: '系统', items: ['权限配置' as NavSection, '快捷键绑定' as NavSection, '自定义命令' as NavSection, '指令文件' as NavSection, '高级设置' as NavSection] },
  { title: '开发', items: ['JSON 编辑器' as NavSection] },
];

/** 应用配置（原子 — 不可变） */
export const APP_CONFIG: AppConfig = Object.freeze({
  name: 'opencode 配置面板',
  version: '0.1.0',
  repo: 'https://github.com/opencode-ai/opencode',
});
