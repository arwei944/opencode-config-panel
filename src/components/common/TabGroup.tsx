/**
 * 标签页组件
 * 支持水平/垂直方向，可滚动
 */

interface Tab {
  /** 唯一标识 */
  key: string;
  /** 显示文字 */
  label: string;
  /** 徽标数字 */
  badge?: number;
  /** 是否禁用 */
  disabled?: boolean;
}

interface TabGroupProps {
  /** 标签列表 */
  tabs: Tab[];
  /** 当前激活的 key */
  activeKey: string;
  /** 切换回调 */
  onChange: (key: string) => void;
  /** 方向 */
  direction?: 'horizontal' | 'vertical';
  /** 自定义类名 */
  className?: string;
}

/**
 * 标签页切换组件
 * @example
 * <TabGroup tabs={[{key:'all',label:'全部'},{key:'active',label:'启用'}]} activeKey="all" onChange={setTab} />
 */
export function TabGroup({
  tabs,
  activeKey,
  onChange,
  direction = 'horizontal',
  className = '',
}: TabGroupProps) {
  const isHorizontal = direction === 'horizontal';

  return (
    <div
      className={`
        flex
        ${isHorizontal ? 'border-b border-gray-200 dark:border-gray-700 overflow-x-auto' : 'flex-col gap-0.5'}
        ${className}
      `}
      role="tablist"
    >
      {tabs.map(tab => {
        const isActive = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => onChange(tab.key)}
            className={`
              relative flex items-center gap-1.5 whitespace-nowrap text-sm font-medium transition-colors
              ${isHorizontal
                ? 'px-4 py-2.5 border-b-2 -mb-px'
                : 'px-3 py-2 rounded-md'
              }
              ${isActive
                ? isHorizontal
                  ? 'border-primary-600 text-primary-600'
                  : 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }
              ${tab.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span className={`
                inline-flex items-center justify-center px-1.5 py-0.5 text-xs rounded-full font-medium
                ${isActive
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-800 dark:text-primary-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}
              `}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
