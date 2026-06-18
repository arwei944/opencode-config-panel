/**
 * JSON 预览组件
 * 语法高亮、可折叠的只读 JSON 展示，支持自动刷新
 */

import { useState, useEffect, useRef } from 'react';

interface JsonPreviewProps {
  /** JSON 数据 */
  data: unknown;
  /** 是否默认展开 */
  defaultExpanded?: boolean;
  /** 最大展开深度 */
  maxDepth?: number;
  /** 标题 */
  title?: string;
  /** 是否自动刷新（监听 data 引用变化） */
  autoRefresh?: boolean;
}

/**
 * JSON 预览组件
 * @example
 * <JsonPreview data={{name:'test', items:[1,2,3]}} />
 */
export function JsonPreview({ data, defaultExpanded = true, maxDepth = 10, title, autoRefresh }: JsonPreviewProps) {
  const [collapsed, setCollapsed] = useState(!defaultExpanded);
  const [refreshKey, setRefreshKey] = useState(0);
  const prevDataRef = useRef<unknown>(data);

  // 自动刷新：当 data 发生变化时递增 refreshKey 触发重新渲染
  useEffect(() => {
    if (!autoRefresh) return;
    if (prevDataRef.current !== data) {
      prevDataRef.current = data;
      setRefreshKey(k => k + 1);
    }
  }, [data, autoRefresh]);

  return (
    <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
      {title && (
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <span className="icon text-lg leading-none transition-transform" style={{ transform: collapsed ? 'rotate(-90deg)' : '' }}>
            expand_more
          </span>
          {title}
          {autoRefresh && <span className="ml-auto text-xs text-gray-400">实时</span>}
        </button>
      )}
      {!collapsed && (
        <pre className="p-3 text-xs font-mono overflow-auto max-h-96 bg-gray-50 dark:bg-gray-900" key={refreshKey}>
          <JsonNode data={data} depth={0} maxDepth={maxDepth} />
        </pre>
      )}
    </div>
  );
}

/** JSON 节点递归渲染 */
function JsonNode({ data, depth, maxDepth }: { data: unknown; depth: number; maxDepth: number }) {
  if (depth >= maxDepth) {
    return <span className="text-gray-400">...</span>;
  }

  if (data === null) return <span className="text-gray-400">null</span>;
  if (data === undefined) return <span className="text-gray-400">undefined</span>;

  if (typeof data === 'string') {
    return <span className="text-green-600 dark:text-green-400">"{data}"</span>;
  }
  if (typeof data === 'number') return <span className="text-blue-600 dark:text-blue-400">{data}</span>;
  if (typeof data === 'boolean') return <span className="text-purple-600 dark:text-purple-400">{String(data)}</span>;

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-gray-400">[]</span>;
    const lines = data.map((item, i) => (
      <div key={i} style={{ paddingLeft: 16 }}>
        <span className="text-gray-500">- </span>
        <JsonNode data={item} depth={depth + 1} maxDepth={maxDepth} />
        {i < data.length - 1 && <span className="text-gray-400">,</span>}
      </div>
    ));
    return <div className="text-gray-300">[<br />{lines}<br />]</div>;
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-gray-400">{'{}'}</span>;
    const lines = entries.map(([key, val], i) => (
      <div key={key} style={{ paddingLeft: 16 }}>
        <span className="text-red-600 dark:text-red-400">"{key}"</span>
        <span className="text-gray-400">: </span>
        <JsonNode data={val} depth={depth + 1} maxDepth={maxDepth} />
        {i < entries.length - 1 && <span className="text-gray-400">,</span>}
      </div>
    ));
    return <div className="text-gray-300">{'{'}<br />{lines}<br />{'}'}</div>;
  }

  return <span>{String(data)}</span>;
}
