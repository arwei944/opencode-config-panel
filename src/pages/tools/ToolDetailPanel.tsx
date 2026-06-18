/**
 * 工具详情侧栏组件
 * 从右侧滑出的面板，显示工具详情和代理覆盖编辑
 */

import { Toggle } from '../../components/common/Toggle';
import { Badge } from '../../components/common/Badge';
import { AgentToolOverrides } from './AgentToolOverrides';
import type { ToolInfo } from '../../api/tools';

interface ToolDetailPanelProps {
  /** 工具信息 */
  tool: ToolInfo;
  /** 全局启用状态 */
  globalEnabled: boolean;
  /** 是否打开 */
  open: boolean;
  /** 全局开关变更 */
  onGlobalToggle: (enabled: boolean) => void;
  /** 代理覆盖变更 */
  onOverrideChange: (agentName: string, enabled: boolean | null) => void;
  /** 关闭回调 */
  onClose: () => void;
}

/**
 * 工具详情侧栏面板
 */
export function ToolDetailPanel({
  tool,
  globalEnabled,
  open,
  onGlobalToggle,
  onOverrideChange,
  onClose,
}: ToolDetailPanelProps) {
  if (!open) return null;

  return (
    <>
      {/* 遮罩 */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* 侧栏面板 */}
      <div className="fixed right-0 top-0 h-full w-96 max-w-[90vw] bg-white dark:bg-gray-800 shadow-xl z-50 flex flex-col animate-slide-in">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{tool.name}</h3>
            <p className="text-xs text-gray-400 font-mono">{tool.id}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <span className="icon text-xl leading-none">close</span>
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* 基本信息 */}
          <section>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{tool.description}</p>
            <div className="flex items-center gap-2">
              <Badge variant={tool.builtin ? 'default' : 'primary'}>{tool.builtin ? '内置工具' : '自定义工具'}</Badge>
              <Badge variant="info">{tool.category}</Badge>
            </div>
          </section>

          {/* 全局开关 */}
          <section>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">全局设置</h4>
            <Toggle
              checked={globalEnabled}
              onChange={onGlobalToggle}
              label={`全局${globalEnabled ? '启用' : '禁用'} ${tool.name}`}
              onLabel="所有代理均可使用此工具"
              offLabel="此工具将被禁用"
            />
          </section>

          {/* 代理覆盖 */}
          <section>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">代理覆盖</h4>
            <AgentToolOverrides
              toolId={tool.id}
              toolName={tool.name}
              overrides={tool.agentOverrides}
              globalEnabled={globalEnabled}
              onOverrideChange={onOverrideChange}
            />
          </section>
        </div>
      </div>
    </>
  );
}
