/**
 * 常量定义
 * 导航项配置、默认值等
 */

import type { NavItem } from '../types/ui';

/** 全部导航定义 */
export const NAV_ITEMS: NavItem[] = [
  { id: '仪表盘', label: '仪表盘', icon: 'dashboard', path: '/dashboard' },
  { id: '提供商管理', label: '提供商管理', icon: 'cloud', path: '/providers' },
  { id: '代理管理', label: '代理管理', icon: 'smart_toy', path: '/agents' },
  { id: '工具管理', label: '工具管理', icon: 'construction', path: '/tools' },
  { id: '技能管理', label: '技能管理', icon: 'psychology', path: '/skills' },
  { id: 'MCP 服务器', label: 'MCP 服务器', icon: 'dns', path: '/mcp' },
  { id: '事件钩子', label: '事件钩子', icon: 'sync', path: '/hooks' },
  { id: '插件管理', label: '插件管理', icon: 'extension', path: '/plugins' },
  { id: '权限配置', label: '权限配置', icon: 'lock', path: '/permissions' },
  { id: '快捷键绑定', label: '快捷键绑定', icon: 'keyboard', path: '/keybinds' },
  { id: '自定义命令', label: '自定义命令', icon: 'terminal', path: '/commands' },
  { id: '指令文件', label: '指令文件', icon: 'description', path: '/instructions' },
  { id: '高级设置', label: '高级设置', icon: 'settings', path: '/advanced' },
  { id: 'JSON 编辑器', label: 'JSON 编辑器', icon: 'code', path: '/raw' },
];

/** 导航分组配置 */
export const NAV_SECTIONS = [
  { title: '概览', items: ['仪表盘'] },
  { title: '配置管理', items: ['提供商管理', '代理管理', '工具管理', '技能管理', 'MCP 服务器'] },
  { title: '扩展', items: ['事件钩子', '插件管理'] },
  { title: '系统', items: ['权限配置', '快捷键绑定', '自定义命令', '指令文件', '高级设置'] },
  { title: '开发', items: ['JSON 编辑器'] },
];

/** API 基础路径 */
export const API_BASE_URL = '/api';

/** 应用配置 */
export const APP_CONFIG = {
  name: 'opencode 配置面板',
  version: '0.1.0',
  repo: 'https://github.com/opencode-ai/opencode',
};
