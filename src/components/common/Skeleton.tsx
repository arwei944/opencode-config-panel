/**
 * 骨架屏组件
 * 页面加载时展示占位骨架，提升加载体验
 */

interface SkeletonProps {
  /** 骨架类型 */
  variant?: 'text' | 'card' | 'table' | 'page' | 'circle';
  /** 行数（text/table 模式） */
  rows?: number;
  /** 自定义类名 */
  className?: string;
}

/**
 * 骨架屏组件
 * @example
 * <Skeleton variant="page" />
 * <Skeleton variant="card" rows={3} />
 */
export function Skeleton({ variant = 'text', rows = 3, className = '' }: SkeletonProps) {
  if (variant === 'circle') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2" />
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3 ${className}`}>
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/3" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: `${70 + Math.random() * 30}%` }} />
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse flex-1" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'page') {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/4" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
    );
  }

  // text variant (default)
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
      ))}
    </div>
  );
}

/** 页面级骨架屏快捷组件 */
export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton variant="text" rows={2} className="w-64" />
        <Skeleton variant="text" rows={1} className="w-32" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="card" rows={2} />
        ))}
      </div>
      <Skeleton variant="card" rows={6} />
      <Skeleton variant="table" rows={5} />
    </div>
  );
}
