/**
 * 卡片容器组件
 * 带标题、内边距和悬停效果的通用卡片
 */

import type { ReactNode } from 'react';

interface CardProps {
  /** 卡片标题 */
  title?: string;
  /** 标题右侧的附加操作 */
  extra?: ReactNode;
  /** 卡片内容 */
  children: ReactNode;
  /** 是否显示悬停效果 */
  hoverable?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 点击事件 */
  onClick?: () => void;
  /** 内边距大小 */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingMap = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

/**
 * 卡片容器组件
 * @example
 * <Card title="配置概览" extra={<Button>编辑</Button>}>
 *   卡片内容
 * </Card>
 */
export function Card({
  title,
  extra,
  children,
  hoverable = false,
  className = '',
  onClick,
  padding = 'md',
}: CardProps) {
  return (
    <div
      className={`
        bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700
        ${hoverable ? 'hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer transition-shadow' : 'shadow-sm'}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {title && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
          {extra && <div className="flex items-center gap-2">{extra}</div>}
        </div>
      )}
      <div className={`${paddingMap[padding]}`}>{children}</div>
    </div>
  );
}
