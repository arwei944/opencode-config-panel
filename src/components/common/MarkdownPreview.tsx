/**
 * Markdown 预览组件
 * 使用 react-markdown 渲染 Markdown 内容，支持代码高亮和 GFM
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface MarkdownPreviewProps {
  /** Markdown 内容 */
  content: string;
  /** 类名 */
  className?: string;
}

/**
 * Markdown 预览组件
 * @example
 * <MarkdownPreview content="# Hello\nWorld" />
 */
export function MarkdownPreview({ content, className = '' }: MarkdownPreviewProps) {
  const components: Components = {
    // 代码块高亮
    code({ className: cl, children, ...props }) {
      const isInline = !cl?.includes('language-');
      if (isInline) {
        return (
          <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-sm font-mono text-pink-600 dark:text-pink-400" {...props}>
            {children}
          </code>
        );
      }
      return (
        <pre className="rounded-md bg-gray-100 dark:bg-gray-800 p-3 overflow-x-auto text-sm">
          <code className={cl} {...props}>{children}</code>
        </pre>
      );
    },
    // 链接新窗口打开
    a({ href, children, ...props }) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline" {...props}>
          {children}
        </a>
      );
    },
  };

  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
