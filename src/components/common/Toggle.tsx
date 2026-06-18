/**
 * 开关组件
 * 带标签的开/关切换
 */

interface ToggleProps {
  /** 是否开启 */
  checked: boolean;
  /** 变更回调 */
  onChange: (checked: boolean) => void;
  /** 标签文字 */
  label?: string;
  /** 关闭时的描述 */
  offLabel?: string;
  /** 开启时的描述 */
  onLabel?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 唯一标识 */
  id?: string;
}

/**
 * 开关切换组件
 * @example
 * <Toggle checked={true} onChange={setChecked} label="启用自动备份" />
 */
export function Toggle({
  checked,
  onChange,
  label,
  offLabel,
  onLabel,
  disabled = false,
  id,
}: ToggleProps) {
  const toggleId = id || `toggle-${label?.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <label
      htmlFor={toggleId}
      className={`flex items-center gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div className="relative">
        <input
          id={toggleId}
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          disabled={disabled}
        />
        <div
          className={`
            block w-9 h-5 rounded-full transition-colors
            ${checked ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}
          `}
        />
        <div
          className={`
            absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform
            ${checked ? 'translate-x-4' : 'translate-x-0'}
          `}
        />
      </div>
      {(label || offLabel || onLabel) && (
        <div className="flex flex-col">
          {label && <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>}
          {(offLabel || onLabel) && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {checked ? onLabel : offLabel}
            </span>
          )}
        </div>
      )}
    </label>
  );
}
