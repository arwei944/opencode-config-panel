/**
 * 模型能力标签组件
 * 显示模型支持的特性（推理、附件、工具调用等）
 */

interface ModelBadgeProps {
  /** 能力类型 */
  type: 'reasoning' | 'attachment' | 'tool_call' | 'temperature' | 'experimental';
  /** 是否支持 */
  supported?: boolean;
}

const badgeConfig: Record<string, { label: string; icon: string }> = {
  reasoning: { label: '推理', icon: 'psychology' },
  attachment: { label: '附件', icon: 'attach_file' },
  tool_call: { label: '工具调用', icon: 'call' },
  temperature: { label: '温度控制', icon: 'thermostat' },
  experimental: { label: '实验性', icon: 'science' },
};

/**
 * 模型能力标签
 * @example
 * <ModelBadge type="reasoning" supported />
 * <ModelBadge type="experimental" />
 */
export function ModelBadge({ type, supported = true }: ModelBadgeProps) {
  const config = badgeConfig[type];
  if (!config) return null;

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded font-medium
        ${supported
          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
          : 'bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-500 line-through'
        }
      `}
    >
      <span className="icon text-sm leading-none">{config.icon}</span>
      {config.label}
    </span>
  );
}
