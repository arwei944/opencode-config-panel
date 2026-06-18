/**
 * 代理工具覆盖组件
 * 表格形式展示每个代理的工具覆盖状态
 */

import { Toggle } from '../../components/common/Toggle';
import { EmptyState } from '../../components/common/EmptyState';

interface AgentToolOverridesProps {
  /** 工具 ID */
  toolId: string;
  /** 工具名称 */
  toolName: string;
  /** 代理覆盖记录：{ agentName: boolean | null }，null 表示继承全局 */
  overrides: Record<string, boolean | null>;
  /** 全局启用状态 */
  globalEnabled: boolean;
  /** 覆盖变更回调 */
  onOverrideChange: (agentName: string, enabled: boolean | null) => void;
}

/**
 * 代理工具覆盖表格
 */
export function AgentToolOverrides({
  toolId,
  toolName,
  overrides,
  globalEnabled,
  onOverrideChange,
}: AgentToolOverridesProps) {
  const agentNames = Object.keys(overrides);

  if (agentNames.length === 0) {
    return (
      <EmptyState
        icon="group"
        title="无代理覆盖"
        description={`所有代理继承全局设置（${toolName} 当前${globalEnabled ? '启用' : '禁用'}）`}
      />
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        各代理可独立覆盖 "{toolName}" 的启用状态
      </p>
      <div className="space-y-1">
        {agentNames.map(agentName => {
          const overrideValue = overrides[agentName];
          // 实际生效值：覆盖值优先，否则继承全局
          const effectiveValue = overrideValue !== null ? overrideValue : globalEnabled;

          return (
            <div
              key={agentName}
              className="flex items-center justify-between px-3 py-2 rounded-md bg-gray-50 dark:bg-gray-800/50"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{agentName}</span>
                {overrideValue !== null ? (
                  <span className="text-xs text-amber-500">已覆盖</span>
                ) : (
                  <span className="text-xs text-gray-400">继承全局</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Toggle
                  checked={effectiveValue}
                  onChange={checked => onOverrideChange(agentName, checked)}
                  id={`override-${toolId}-${agentName}`}
                />
                {overrideValue !== null && (
                  <button
                    type="button"
                    onClick={() => onOverrideChange(agentName, null)}
                    className="text-xs text-gray-400 hover:text-red-500"
                    title="恢复继承全局"
                  >
                    重置
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
