/**
 * 搜索输入框组件
 * 带防抖、清除按钮和搜索图标
 */

import { useState, useEffect, useRef } from 'react';

interface SearchInputProps {
  /** 占位文字 */
  placeholder?: string;
  /** 值变更回调（已防抖） */
  onSearch: (value: string) => void;
  /** 防抖延迟（毫秒） */
  debounceMs?: number;
  /** 类名 */
  className?: string;
}

/**
 * 搜索输入框组件
 * @example
 * <SearchInput onSearch={handleSearch} placeholder="搜索提供商..." />
 */
export function SearchInput({
  placeholder = '搜索...',
  onSearch,
  debounceMs = 300,
  className = '',
}: SearchInputProps) {
  const [value, setValue] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSearch(value);
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, debounceMs, onSearch]);

  function handleClear() {
    setValue('');
    onSearch('');
  }

  return (
    <div className={`relative ${className}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        <span className="icon text-xl leading-none">search</span>
      </span>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-8 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          aria-label="清除搜索"
        >
          <span className="icon text-lg leading-none">close</span>
        </button>
      )}
    </div>
  );
}
