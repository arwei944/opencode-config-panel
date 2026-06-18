/**
 * 加载中组件
 * 显示旋转动画和可选的文字说明
 */

interface LoadingProps {
  /** 加载文字说明 */
  text?: string;
  /** 尺寸大小 */
  size?: 'sm' | 'md' | 'lg';
  /** 是否全屏居中 */
  fullScreen?: boolean;
}

const sizeMap = {
  sm: { spinner: 'h-5 w-5', text: 'text-xs' },
  md: { spinner: 'h-8 w-8', text: 'text-sm' },
  lg: { spinner: 'h-12 w-12', text: 'text-base' },
};

/**
 * 加载中组件
 * @example
 * <Loading text="正在加载配置..." />
 * <Loading size="sm" />
 * <Loading fullScreen text="请稍候" />
 */
export function Loading({ text, size = 'md', fullScreen = false }: LoadingProps) {
  const { spinner, text: textSize } = sizeMap[size];

  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <svg className={`animate-spin ${spinner} text-primary-600`} viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      {text && <p className={`${textSize} text-gray-500 dark:text-gray-400`}>{text}</p>}
    </div>
  );

  if (fullScreen) {
    return <div className="fixed inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-950/80 z-50">{content}</div>;
  }

  return <div className="flex items-center justify-center py-8">{content}</div>;
}
