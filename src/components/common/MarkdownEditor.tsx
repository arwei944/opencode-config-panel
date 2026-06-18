/**
 * Markdown 编辑器组件
 * 带基础工具栏的文本编辑区
 */

import { useRef, type TextareaHTMLAttributes } from 'react';

interface MarkdownEditorProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  /** Markdown 内容 */
  value: string;
  /** 内容变更回调 */
  onChange: (value: string) => void;
  /** 标签文字 */
  label?: string;
  /** 最小高度 */
  minHeight?: number;
}

/**
 * Markdown 编辑器组件
 * 提供工具栏（加粗、斜体、链接、代码等）和编辑区
 * @example
 * <MarkdownEditor value={content} onChange={setContent} label="提示词" />
 */
export function MarkdownEditor({
  value,
  onChange,
  label,
  minHeight = 300,
  className = '',
  ...props
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertFormat(before: string, after: string, fallback = '文字') {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.substring(start, end) || fallback;
    const newValue = value.substring(0, start) + before + selected + after + value.substring(end);
    onChange(newValue);

    // 恢复光标位置
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  const tools = [
    { label: 'B', title: '加粗', action: () => insertFormat('**', '**', '粗体文本') },
    { label: 'I', title: '斜体', action: () => insertFormat('*', '*', '斜体文本') },
    { label: 'H2', title: '标题', action: () => insertFormat('\n## ', '\n', '标题') },
    { label: '🔗', title: '链接', action: () => insertFormat('[', '](url)', '链接文字') },
    { label: '`', title: '行内代码', action: () => insertFormat('`', '`', 'code') },
    { label: '```', title: '代码块', action: () => insertFormat('\n```\n', '\n```\n', '代码') },
    { label: '-', title: '列表项', action: () => insertFormat('\n- ', '', '列表项') },
    { label: '>', title: '引用', action: () => insertFormat('\n> ', '', '引用文字') },
  ];

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      )}
      <div className="rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden focus-within:ring-2 focus-within:ring-primary-500">
        {/* 工具栏 */}
        <div className="flex items-center gap-0.5 px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-wrap">
          {tools.map(tool => (
            <button
              key={tool.label}
              type="button"
              title={tool.title}
              onClick={tool.action}
              className="px-2 py-1 text-xs font-mono rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            >
              {tool.label}
            </button>
          ))}
        </div>
        {/* 编辑区 */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ minHeight }}
          className={`
            w-full px-3 py-2 text-sm font-mono
            bg-white dark:bg-gray-800
            text-gray-900 dark:text-gray-100
            placeholder:text-gray-400
            resize-y outline-none
            ${className}
          `}
          {...props}
        />
      </div>
    </div>
  );
}
