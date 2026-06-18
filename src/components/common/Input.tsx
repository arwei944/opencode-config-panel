/**
 * 输入框组件
 * 带标签、错误提示和说明文字的文本输入
 */

import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** 标签文字 */
  label?: string;
  /** 错误信息 */
  error?: string;
  /** 帮助说明文字 */
  helpText?: string;
}

/**
 * 通用输入框组件
 * @example
 * <Input label="提供商名称" error="名称不能为空" placeholder="输入名称" />
 * <Input label="API地址" helpText="请输入完整的API端点URL" />
 */
export function Input({
  label,
  error,
  helpText,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || `input-${label?.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`
          px-3 py-2 rounded-md border text-sm transition-colors
          bg-white dark:bg-gray-800
          text-gray-900 dark:text-gray-100
          placeholder:text-gray-400 dark:placeholder:text-gray-500
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
          disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:cursor-not-allowed
          ${error
            ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-300 dark:border-gray-600'}
          ${className}
        `}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : helpText ? `${inputId}-help` : undefined}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
      {helpText && !error && (
        <p id={`${inputId}-help`} className="text-xs text-gray-400 dark:text-gray-500">
          {helpText}
        </p>
      )}
    </div>
  );
}
