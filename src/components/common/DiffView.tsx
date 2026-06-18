/**
 * Diff 视图组件
 * 展示两个 JSON 对象之间的差异（行级对比）
 */

import { useMemo, useState } from 'react';

interface DiffViewProps {
  /** 旧数据 */
  oldData: unknown;
  /** 新数据 */
  newData: unknown;
  /** 标题 */
  title?: string;
}

interface DiffLine {
  type: 'same' | 'added' | 'removed' | 'modified';
  key: string;
  oldValue?: string;
  newValue?: string;
}

/**
 * 递归对比两个值，生成扁平差异行列表
 */
function computeDiff(oldVal: unknown, newVal: unknown, path = ''): DiffLine[] {
  const lines: DiffLine[] = [];

  if (oldVal === newVal) {
    if (path) lines.push({ type: 'same', key: path, oldValue: formatValue(oldVal), newValue: formatValue(newVal) });
    return lines;
  }

  if (typeof oldVal !== 'object' || typeof newVal !== 'object' || oldVal === null || newVal === null) {
    lines.push({ type: 'modified', key: path, oldValue: formatValue(oldVal), newValue: formatValue(newVal) });
    return lines;
  }

  const oldKeys = new Set(Object.keys(oldVal as Record<string, unknown>));
  const newKeys = new Set(Object.keys(newVal as Record<string, unknown>));

  // 移除的键
  for (const key of oldKeys) {
    const fullPath = path ? `${path}.${key}` : key;
    if (!newKeys.has(key)) {
      lines.push({ type: 'removed', key: fullPath, oldValue: formatValue((oldVal as Record<string, unknown>)[key]) });
    } else {
      lines.push(...computeDiff((oldVal as Record<string, unknown>)[key], (newVal as Record<string, unknown>)[key], fullPath));
    }
  }

  // 新增的键
  for (const key of newKeys) {
    if (!oldKeys.has(key)) {
      const fullPath = path ? `${path}.${key}` : key;
      lines.push({ type: 'added', key: fullPath, newValue: formatValue((newVal as Record<string, unknown>)[key]) });
    }
  }

  return lines;
}

function formatValue(val: unknown): string {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (typeof val === 'string') return `"${val}"`;
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

/**
 * Diff 视图组件
 * @example
 * <DiffView oldData={{a:1}} newData={{a:2, b:3}} />
 */
export function DiffView({ oldData, newData, title }: DiffViewProps) {
  const [showAll, setShowAll] = useState(false);

  const diffs = useMemo(() => computeDiff(oldData, newData), [oldData, newData]);

  if (diffs.length === 0) {
    return (
      <div className="rounded-md border border-gray-200 dark:border-gray-700 p-4 text-center text-sm text-gray-400">
        无差异
      </div>
    );
  }

  const displayed = showAll ? diffs : diffs.slice(0, 50);
  const hasMore = diffs.length > 50;

  return (
    <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
      {title && (
        <div className="px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
          {title}
          <span className="ml-2 text-gray-400">({diffs.filter(d => d.type !== 'same').length} 处变更)</span>
        </div>
      )}
      <div className="overflow-auto max-h-96">
        {displayed.map((diff, i) => {
          const bgClass = {
            same: 'bg-transparent',
            added: 'bg-green-50 dark:bg-green-900/20',
            removed: 'bg-red-50 dark:bg-red-900/20',
            modified: 'bg-yellow-50 dark:bg-yellow-900/20',
          }[diff.type];

          const textClass = {
            same: 'text-gray-600 dark:text-gray-400',
            added: 'text-green-700 dark:text-green-300',
            removed: 'text-red-700 dark:text-red-300',
            modified: 'text-yellow-700 dark:text-yellow-300',
          }[diff.type];

          const prefix = { same: '  ', added: '+ ', removed: '- ', modified: '~ ' }[diff.type];

          return (
            <div key={i} className={`flex items-start gap-2 px-3 py-1 text-xs font-mono ${bgClass} ${textClass}`}>
              <span className="w-4 shrink-0 select-none">{prefix}</span>
              <span className="text-gray-400 dark:text-gray-500 shrink-0">{diff.key}</span>
              {diff.oldValue !== undefined && (
                <span className="line-through opacity-60">{diff.oldValue}</span>
              )}
              {diff.newValue !== undefined && (
                <span>{diff.newValue}</span>
              )}
            </div>
          );
        })}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="w-full px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700"
        >
          {showAll ? '收起' : `显示全部 ${diffs.length} 项差异`}
        </button>
      )}
    </div>
  );
}
