/**
 * 标签输入组件
 * 支持添加、删除标签，键盘操作
 */

import { useState, type KeyboardEvent } from 'react';

interface TagInputProps {
  /** 标签列表 */
  value: string[];
  /** 变更回调 */
  onChange: (tags: string[]) => void;
  /** 标签文字 */
  label?: string;
  /** 占位文字 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 允许重复 */
  allowDuplicates?: boolean;
}

/**
 * 标签输入组件
 * @example
 * <TagInput value={['typescript', 'react']} onChange={setTags} label="标签" />
 */
export function TagInput({
  value,
  onChange,
  label,
  placeholder = '输入后按回车添加',
  disabled = false,
  allowDuplicates = false,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed) return;
    if (!allowDuplicates && value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setInputValue('');
  }

  function removeTag(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(inputValue);
    }
    if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeTag(value.length - 1);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      )}
      <div
        className={`
          flex flex-wrap gap-1.5 px-3 py-2 rounded-md border text-sm
          bg-white dark:bg-gray-800
          border-gray-300 dark:border-gray-600
          focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {value.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeTag(index)}
                className="hover:text-red-500 focus:outline-none"
                aria-label={`删除标签 ${tag}`}
              >
                <span className="icon text-base leading-none">close</span>
              </button>
            )}
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="flex-1 min-w-[80px] outline-none bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
        />
      </div>
    </div>
  );
}
