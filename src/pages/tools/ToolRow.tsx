/**
 * 工具行组件
 * 显示工具的名称、描述、全局开关和分类徽标
 */

import { Toggle } from '../../components/common/Toggle';
import { Badge } from '../../components/common/Badge';
import type { ToolInfo } from '../../api/tools';

interface ToolRowProps {
  /** 工具信息 */
  tool: ToolInfo;
  /** 全局开关值 */
  globalEnabled: boolean;
  /** 开关变更回调 */
  onToggle: (enabled: boolean) => void;
  /** 点击行回调（打开详情） */
  onClick: () => void;
}

/**
 * 工具行组件
 */
export function ToolRow({ tool, globalEnabled, onToggle, onClick }: ToolRowProps) {
  const overrides = tool.agentOverrides || {};
  const hasOverrides = Object.keys(overrides).length > 0;
  const overrideCount = Object.values(overrides).filter(v => v !== null).length;

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      {/* 工具名称和描述 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{tool.name}</span>
          <Badge variant={tool.builtin ? 'default' : 'primary'} size="sm">
            {tool.builtin ? '内置' : '自定义'}
          </Badge>
          <Badge variant="info" size="sm">{tool.category}</Badge>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{tool.description}</p>
      </div>

      {/* 代理覆盖指示 */}
      {hasOverrides && (
        <span className="text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap">
          {overrideCount} 个代理覆盖
        </span>
      )}

      {/* 开关 */}
      <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
        <Toggle
          checked={globalEnabled}
          onChange={onToggle}
          id={`tool-${tool.id}`}
        />
      </div>
    </div>
  );
}
