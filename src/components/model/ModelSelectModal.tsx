/**
 * 模型选择弹窗组件
 * 按提供商分组，支持搜索
 */

import { useState, useMemo } from 'react';
import { SearchInput } from '../common/SearchInput';
import type { ModelConfig } from '../../types/config';

interface ModelOption {
  provider: string;
  modelKey: string;
  model: ModelConfig;
}

interface ModelSelectModalProps {
  /** 是否打开 */
  open: boolean;
  /** 提供商模型数据：{ providerName: { modelKey: ModelConfig } } */
  providerModels: Record<string, Record<string, ModelConfig>>;
  /** 当前选中的模型字符串（格式: provider/model） */
  value?: string;
  /** 选择回调 */
  onSelect: (modelKey: string) => void;
  /** 关闭回调 */
  onClose: () => void;
}

/**
 * 模型选择弹窗
 * @example
 * <ModelSelectModal open={true} providerModels={data} onSelect={handleSelect} onClose={handleClose} />
 */
export function ModelSelectModal({
  open,
  providerModels,
  value,
  onSelect,
  onClose,
}: ModelSelectModalProps) {
  const [search, setSearch] = useState('');

  const allModels: ModelOption[] = useMemo(() => {
    const result: ModelOption[] = [];
    for (const [provider, models] of Object.entries(providerModels)) {
      for (const [modelKey, model] of Object.entries(models)) {
        result.push({ provider, modelKey, model });
      }
    }
    return result;
  }, [providerModels]);

  const filtered = useMemo(() => {
    if (!search) return allModels;
    const q = search.toLowerCase();
    return allModels.filter(
      m =>
        m.modelKey.toLowerCase().includes(q) ||
        m.model.name?.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q),
    );
  }, [allModels, search]);

  // 按提供商分组
  const grouped = useMemo(() => {
    const groups: Record<string, ModelOption[]> = {};
    for (const m of filtered) {
      if (!groups[m.provider]) groups[m.provider] = [];
      groups[m.provider].push(m);
    }
    return groups;
  }, [filtered]);

  if (!open) return null;

  function isSelected(provider: string, modelKey: string) {
    return value === `${provider}/${modelKey}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[70vh] flex flex-col">
        {/* 头部 */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">选择模型</h3>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <span className="icon text-xl leading-none">close</span>
            </button>
          </div>
          <SearchInput onSearch={setSearch} placeholder="搜索模型..." />
        </div>

        {/* 模型列表 */}
        <div className="flex-1 overflow-y-auto p-2">
          {Object.entries(grouped).length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">未找到匹配的模型</p>
          ) : (
            Object.entries(grouped).map(([provider, models]) => (
              <div key={provider} className="mb-3">
                <p className="px-2 py-1 text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">
                  {provider}
                </p>
                {models.map(m => (
                  <button
                    key={`${m.provider}/${m.modelKey}`}
                    type="button"
                    onClick={() => onSelect(`${m.provider}/${m.modelKey}`)}
                    className={`
                      w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors
                      ${isSelected(m.provider, m.modelKey)
                        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }
                    `}
                  >
                    <span className="font-mono text-xs text-gray-400">{m.provider}/</span>
                    <span className="font-medium">{m.model.name || m.modelKey}</span>
                    {m.model.status === 'deprecated' && (
                      <span className="text-xs text-yellow-500 ml-auto">已废弃</span>
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
