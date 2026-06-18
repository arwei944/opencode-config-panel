/**
 * 简易代码编辑器组件
 * 带行号和语法高亮的文本编辑/展示区域
 */

import { type KeyboardEvent } from 'react';

interface CodeEditorProps {
  /** 代码内容 */
  value: string;
  /** 内容变更回调（只读模式不传） */
  onChange?: (value: string) => void;
  /** 语言标识 */
  language?: string;
  /** 是否只读 */
  readOnly?: boolean;
  /** 标签文字 */
  label?: string;
  /** 最小高度 */
  minHeight?: number;
}

/**
 * 简易代码编辑器组件
 * 支持行号显示、语法高亮和只读模式
 * @example
 * <CodeEditor value={code} onChange={setCode} language="json" />
 * <CodeEditor value={config} readOnly label="配置预览" />
 */
export function CodeEditor({
  value,
  onChange,
  language = 'text',
  readOnly = false,
  label,
  minHeight = 200,
}: CodeEditorProps) {
  const lineCount = value.split('\n').length;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (onChange) {
        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue = value.substring(0, start) + '  ' + value.substring(end);
        onChange(newValue);
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        });
      }
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
          <span className="text-xs text-gray-400 uppercase">{language}</span>
        </div>
      )}
      <div
        className="rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden"
        style={{ minHeight }}
      >
        <div className="flex">
          {/* 行号 */}
          <div className="select-none px-2 py-2 text-right text-xs leading-5 font-mono text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 min-w-[3rem]">
            {lineNumbers.map(n => (
              <div key={n}>{n}</div>
            ))}
          </div>
          {/* 代码区 */}
          <textarea
            value={value}
            onChange={e => onChange?.(e.target.value)}
            onKeyDown={handleKeyDown}
            readOnly={readOnly}
            spellCheck={false}
            className={`
              flex-1 px-3 py-2 text-sm leading-5 font-mono
              bg-white dark:bg-gray-800
              text-gray-900 dark:text-gray-100
              resize-y outline-none
              ${readOnly ? 'cursor-default' : ''}
            `}
            style={{ minHeight }}
          />
        </div>
      </div>
    </div>
  );
}
