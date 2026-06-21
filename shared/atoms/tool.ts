/**
 * ============================================================
 * 原子：Tool
 * 描述：工具配置的类型定义（最小不可变单元）
 * 约束：本原子不可修改，所有变更应通过 Port 接口进行
 * ============================================================
 */

/** 工具分类 */
export type ToolCategory = '文件操作' | '执行工具' | '网络工具' | '代理工具' | '工具链' | '自定义';

/** 工具信息原子 */
export interface ToolInfo {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  builtin: boolean;
  source?: string;
  enabled: boolean;
  agentOverrides: Record<string, boolean | null>;
}

/** 工具列表结果原子 */
export interface ToolListResult {
  tools: ToolInfo[];
  globalToolSettings: Record<string, boolean>;
  primaryTools: string[];
}

/** 内置工具定义原子（不可变） */
export const BUILTIN_TOOLS: ReadonlyArray<Omit<ToolInfo, 'enabled' | 'agentOverrides'>> = Object.freeze([
  // 文件操作
  Object.freeze({ id: 'read', name: 'Read', description: '读取文件内容', category: '文件操作' as ToolCategory, builtin: true, source: undefined }),
  Object.freeze({ id: 'edit', name: 'Edit', description: '编辑文件内容', category: '文件操作' as ToolCategory, builtin: true, source: undefined }),
  Object.freeze({ id: 'write', name: 'Write', description: '写入文件', category: '文件操作' as ToolCategory, builtin: true, source: undefined }),
  Object.freeze({ id: 'glob', name: 'Glob', description: '文件模式匹配查找', category: '文件操作' as ToolCategory, builtin: true, source: undefined }),
  Object.freeze({ id: 'grep', name: 'Grep', description: '文件内容搜索', category: '文件操作' as ToolCategory, builtin: true, source: undefined }),

  // 执行工具
  Object.freeze({ id: 'bash', name: 'Bash', description: '执行 shell 命令', category: '执行工具' as ToolCategory, builtin: true, source: undefined }),

  // 网络工具
  Object.freeze({ id: 'webfetch', name: 'Web Fetch', description: '获取 URL 内容', category: '网络工具' as ToolCategory, builtin: true, source: undefined }),
  Object.freeze({ id: 'websearch', name: 'Web Search', description: '搜索网络信息', category: '网络工具' as ToolCategory, builtin: true, source: undefined }),

  // 代理工具
  Object.freeze({ id: 'task', name: 'Task', description: '启动子代理执行任务', category: '代理工具' as ToolCategory, builtin: true, source: undefined }),

  // 工具链
  Object.freeze({ id: 'todowrite', name: 'Todo Write', description: '创建和管理任务列表', category: '工具链' as ToolCategory, builtin: true, source: undefined }),
  Object.freeze({ id: 'skill', name: 'Skill', description: '加载技能文件', category: '工具链' as ToolCategory, builtin: true, source: undefined }),

  // 其他
  Object.freeze({ id: 'question', name: 'Question', description: '向用户提问', category: '工具链' as ToolCategory, builtin: true, source: undefined }),
]);

/** 工具分类排序 */
export const CATEGORY_ORDER: ReadonlyArray<ToolCategory> = Object.freeze([
  '文件操作', '执行工具', '网络工具', '代理工具', '工具链', '自定义',
]);
