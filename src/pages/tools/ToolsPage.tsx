/**
 * 工具管理页面
 * 分类展示 + 全局开关 + 搜索 + 主代理专属工具配置
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchTools, updateGlobalTools, updateAgentToolOverrides, resetAgentToolOverrides, updatePrimaryTools } from '../../api/tools';
import type { ToolInfo } from '../../api/tools';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { SearchInput } from '../../components/common/SearchInput';
import { Loading } from '../../components/common/Loading';
import { EmptyState } from '../../components/common/EmptyState';
import { TabGroup } from '../../components/common/TabGroup';
import { TagInput } from '../../components/common/TagInput';
import { Toast } from '../../components/common/Toast';
import { useNotification } from '../../hooks/useNotification';
import { ToolRow } from './ToolRow';
import { ToolDetailPanel } from './ToolDetailPanel';

/** 工具分类标签 */
const CATEGORY_TABS = [
  { key: 'all', label: '全部' },
  { key: '文件操作', label: '文件操作' },
  { key: '执行工具', label: '执行工具' },
  { key: '网络工具', label: '网络工具' },
  { key: '代理工具', label: '代理工具' },
  { key: '工具链', label: '工具链' },
  { key: '自定义', label: '自定义' },
];

/**
 * 工具管理页面
 */
export function ToolsPage() {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [globalSettings, setGlobalSettings] = useState<Record<string, boolean>>({});
  const [primaryTools, setPrimaryTools] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  // 详情面板状态
  const [selectedTool, setSelectedTool] = useState<ToolInfo | null>(null);

  const { notifications, success, error: notifyError, remove } = useNotification();

  const loadTools = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTools();
      setTools(data.tools);
      setGlobalSettings(data.globalToolSettings);
      setPrimaryTools(data.primaryTools);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载工具失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTools();
  }, [loadTools]);

  /** 过滤后的工具列表 */
  const filteredTools = useMemo(() => {
    return tools.filter(tool => {
      if (category !== 'all' && tool.category !== category) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!tool.name.toLowerCase().includes(q) && !tool.id.toLowerCase().includes(q) && !tool.description.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [tools, category, search]);

  /** 切换全局工具开关 */
  async function handleGlobalToggle(toolId: string, enabled: boolean) {
    const updated = { ...globalSettings, [toolId]: enabled };
    setGlobalSettings(updated);
    try {
      await updateGlobalTools({ [toolId]: enabled });
      success(`${tools.find(t => t.id === toolId)?.name} 已${enabled ? '启用' : '禁用'}`);
    } catch (err) {
      notifyError('更新失败');
      loadTools();
    }
  }

  /** 切换代理覆盖 */
  async function handleOverrideChange(toolId: string, agentName: string, enabled: boolean | null) {
    const tool = tools.find(t => t.id === toolId);
    if (!tool) return;

    if (enabled === null) {
      // 重置
      try {
        await resetAgentToolOverrides(agentName);
        loadTools();
      } catch (err) {
        notifyError('重置失败');
      }
    } else {
      try {
        await updateAgentToolOverrides(agentName, { [toolId]: enabled });
        loadTools();
      } catch (err) {
        notifyError('更新失败');
      }
    }
  }

  /** 更新主代理专属工具 */
  async function handlePrimaryToolsChange(newTools: string[]) {
    setPrimaryTools(newTools);
    try {
      await updatePrimaryTools(newTools);
      success('主代理专属工具已更新');
    } catch (err) {
      notifyError('更新失败');
      loadTools();
    }
  }

  if (loading) return <Loading text="正在加载工具..." />;

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={loadTools}>重试</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">工具管理</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            控制各工具的启用状态和代理覆盖
          </p>
        </div>
      </div>

      {/* 主代理专属工具配置（4.2.7） */}
      <Card title="主代理专属工具">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          只有在此列表中的工具才可由主代理（非 subagent 模式）调用
        </p>
        <TagInput
          value={primaryTools}
          onChange={handlePrimaryToolsChange}
          placeholder="输入工具 ID 后按回车添加"
        />
      </Card>

      {/* 搜索和分类过滤 */}
      <div className="flex items-center gap-4">
        <SearchInput onSearch={setSearch} placeholder="搜索工具..." className="w-64" />
        <TabGroup tabs={CATEGORY_TABS} activeKey={category} onChange={setCategory} />
      </div>

      {/* 工具列表 */}
      <Card padding="none">
        {filteredTools.length === 0 ? (
          <EmptyState icon="construction" title="没有匹配的工具" description="尝试修改搜索条件" />
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredTools.map(tool => (
              <ToolRow
                key={tool.id}
                tool={tool}
                globalEnabled={globalSettings[tool.id] !== false}
                onToggle={enabled => handleGlobalToggle(tool.id, enabled)}
                onClick={() => setSelectedTool(tool)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* 工具详情侧栏 */}
      {selectedTool && (
        <ToolDetailPanel
          tool={selectedTool}
          globalEnabled={globalSettings[selectedTool.id] !== false}
          open={!!selectedTool}
          onGlobalToggle={enabled => handleGlobalToggle(selectedTool.id, enabled)}
          onOverrideChange={(agentName, enabled) => handleOverrideChange(selectedTool.id, agentName, enabled)}
          onClose={() => setSelectedTool(null)}
        />
      )}

      <Toast notifications={notifications} onRemove={remove} />
    </div>
  );
}
