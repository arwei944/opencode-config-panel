/**
 * 下拉选择组件
 * 支持选项分组和自定义占位文本
 */

import type { SelectHTMLAttributes } from 'react';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectGroup {
  label: string;
  options: SelectOption[];
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  /** 标签文字 */
  label?: string;
  /** 选项列表 */
  options: SelectOption[];
  /** 选项分组 */
  groups?: SelectGroup[];
  /** 占位文本 */
  placeholder?: string;
  /** 错误信息 */
  error?: string;
}

/**
 * 下拉选择组件
 * @example
 * <Select label="模型" options={[{value:'gpt-4',label:'GPT-4'}]} />
 * <Select label="代理" groups={[{label:'主代理', options:[...]}]} />
 */
export function Select({
  label,
  options,
  groups,
  placeholder = '请选择...',
  error,
  className = '',
  id,
  ...props
}: SelectProps) {
  const selectId = id || `select-${label?.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`
          px-3 py-2 rounded-md border text-sm bg-white dark:bg-gray-800
          text-gray-900 dark:text-gray-100
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
          disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-gray-900
          ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
          ${className}
        `}
        aria-invalid={!!error}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {groups
          ? groups.map(group => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map(opt => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            ))
          : options.map(opt => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
      </select>
      {error && (
        <p className="text-xs text-red-500" role="alert">{error}</p>
      )}
    </div>
  );
}
