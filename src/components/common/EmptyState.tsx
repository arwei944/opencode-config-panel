/**
 * 空状态组件
 * 在列表或内容为空时显示提示和操作按钮
 */

import type { ReactNode } from 'react';

interface EmptyStateProps {
  /** 图标名称（Material Symbols） */
  icon?: string;
  /** 标题 */
  title?: string;
  /** 描述文字 */
  description?: string;
  /** 操作按钮 */
  action?: ReactNode;
}

/**
 * 空状态组件
 * @example
 * <EmptyState icon="inbox" title="暂无数据" description="点击下方按钮添加" action={<Button>添加</Button>} />
 */
export function EmptyState({ icon = 'inbox', title = '暂无数据', description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <span className="icon text-5xl text-gray-300 dark:text-gray-600 mb-4">{icon}</span>
      <h3 className="text-base font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-400 dark:text-gray-500 mb-4 text-center max-w-xs">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
