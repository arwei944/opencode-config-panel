/**
 * 徽标组件
 * 状态/计数徽标，支持多种颜色变体
 */

import type { ReactNode } from 'react';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  /** 显示内容 */
  children: ReactNode;
  /** 颜色变体 */
  variant?: BadgeVariant;
  /** 尺寸 */
  size?: 'sm' | 'md';
  /** 显示为圆点（仅图标） */
  dot?: boolean;
  /** 自定义类名 */
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  primary: 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300',
  success: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
  danger: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
};

const sizeStyles = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2 py-1 text-xs',
};

/**
 * 徽标组件
 * @example
 * <Badge variant="success">已启用</Badge>
 * <Badge variant="danger" dot>错误</Badge>
 */
export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  dot = false,
  className = '',
}: BadgeProps) {
  if (dot) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <span className={`w-2 h-2 rounded-full ${variantStyles[variant].split(' ')[0]}`} />
        <span className="text-xs text-gray-600 dark:text-gray-400">{children}</span>
      </span>
    );
  }

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
