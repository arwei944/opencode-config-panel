/**
 * 模型列表组件
 * 带搜索、排序和筛选功能
 */

import { useState, useMemo } from 'react';
import { SearchInput } from '../common/SearchInput';
import { Badge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import type { ModelConfig } from '../../types/config';

interface ModelListProps {
  /** 模型列表（key 为模型标识） */
  models: Record<string, ModelConfig>;
  /** 选择模型回调 */
  onSelect?: (key: string, model: ModelConfig) => void;
  /** 删除模型回调 */
  onDelete?: (key: string) => void;
  /** 是否只读 */
  readOnly?: boolean;
}

/**
 * 模型列表组件
 * 支持搜索、按能力筛选
 */
export function ModelList({ models, onSelect, onDelete, readOnly = false }: ModelListProps) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const entries = useMemo(() => Object.entries(models), [models]);

  const filtered = useMemo(() => {
    return entries.filter(([key, model]) => {
      // 搜索过滤
      if (search) {
        const q = search.toLowerCase();
        if (!key.toLowerCase().includes(q) && !model.name?.toLowerCase().includes(q) && !model.id.toLowerCase().includes(q)) {
          return false;
        }
      }
      // 状态过滤
      if (filterStatus === 'active' && model.status === 'deprecated') return false;
      if (filterStatus === 'deprecated' && model.status !== 'deprecated') return false;
      return true;
    });
  }, [entries, search, filterStatus]);

  if (entries.length === 0) {
    return <EmptyState icon="view_module" title="暂无模型" description="点击添加按钮来创建模型" />;
  }

  return (
    <div className="space-y-3">
      {/* 搜索和过滤 */}
      <div className="flex items-center gap-3">
        <SearchInput onSearch={setSearch} placeholder="搜索模型..." className="flex-1" />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-2 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
        >
          <option value="all">全部</option>
          <option value="active">活跃</option>
          <option value="deprecated">已废弃</option>
        </select>
      </div>

      {/* 模型列表 */}
      <div className="space-y-1">
        {filtered.map(([key, model]) => (
          <div
            key={key}
            className={`
              flex items-center gap-3 px-3 py-2 rounded-md text-sm
              ${onSelect ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800' : ''}
              ${model.status === 'deprecated' ? 'opacity-60' : ''}
            `}
            onClick={() => onSelect?.(key, model)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {model.name || key}
                </span>
                {model.status === 'deprecated' && <Badge variant="warning">已废弃</Badge>}
                {model.experimental && <Badge variant="info">实验性</Badge>}
              </div>
              <p className="text-xs text-gray-400 font-mono truncate">{model.id}</p>
            </div>

            {/* 能力标签 */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {model.reasoning && <ModelBadgeInline type="推理" />}
              {model.attachment && <ModelBadgeInline type="附件" />}
              {model.tool_call && <ModelBadgeInline type="工具" />}
            </div>

            {!readOnly && onDelete && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onDelete(key); }}
                className="p-1 text-gray-400 hover:text-red-500 rounded"
                aria-label={`删除模型 ${key}`}
              >
                <span className="icon text-lg leading-none">delete</span>
              </button>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-4">没有匹配的模型</p>
      )}
    </div>
  );
}

/** 行内模型能力标签 */
function ModelBadgeInline({ type }: { type: string }) {
  return (
    <span className="text-xs px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
      {type}
    </span>
  );
}
