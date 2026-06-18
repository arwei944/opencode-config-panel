/**
 * 统计数字卡片组件
 * 显示数字、标签和可选的趋势指示
 */

interface StatsCardProps {
  /** 标题 */
  title: string;
  /** 数值 */
  value: number | string;
  /** 图标名称（Material Symbols） */
  icon?: string;
  /** 趋势变化 */
  trend?: { value: number; direction: 'up' | 'down' };
  /** 附加描述 */
  description?: string;
  /** 点击事件 */
  onClick?: () => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * 统计数字卡片
 * @example
 * <StatsCard title="提供商" value={3} icon="cloud" trend={{value:12, direction:'up'}} />
 */
export function StatsCard({
  title,
  value,
  icon,
  trend,
  description,
  onClick,
  className = '',
}: StatsCardProps) {
  return (
    <div
      className={`
        bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4
        ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : 'shadow-sm'}
        ${className}
      `}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        </div>
        {icon && (
          <span className="icon text-3xl text-gray-300 dark:text-gray-600">{icon}</span>
        )}
      </div>
      {(trend || description) && (
        <div className="mt-2 flex items-center gap-2">
          {trend && (
            <span className={`inline-flex items-center text-xs font-medium ${trend.direction === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              <span className="icon text-base leading-none">
                {trend.direction === 'up' ? 'trending_up' : 'trending_down'}
              </span>
              {trend.value}%
            </span>
          )}
          {description && (
            <span className="text-xs text-gray-400 dark:text-gray-500">{description}</span>
          )}
        </div>
      )}
    </div>
  );
}
