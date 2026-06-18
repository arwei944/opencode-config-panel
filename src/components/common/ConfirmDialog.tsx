/**
 * 确认对话框组件
 * 支持自定义标题、消息、确认/取消按钮文字和样式
 */

import type { ReactNode } from 'react';

interface ConfirmDialogProps {
  /** 是否显示 */
  open: boolean;
  /** 标题 */
  title?: string;
  /** 消息内容 */
  message: string | ReactNode;
  /** 确认按钮文字 */
  confirmText?: string;
  /** 取消按钮文字 */
  cancelText?: string;
  /** 确认按钮样式 */
  confirmVariant?: 'primary' | 'danger';
  /** 确认回调 */
  onConfirm: () => void;
  /** 取消回调 */
  onCancel: () => void;
  /** 加载状态 */
  loading?: boolean;
}

/**
 * 确认对话框组件
 * @example
 * <ConfirmDialog open={true} title="确认删除" message="此操作不可撤销" onConfirm={handleDelete} onCancel={handleClose} />
 */
export function ConfirmDialog({
  open,
  title = '确认操作',
  message,
  confirmText = '确认',
  cancelText = '取消',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      {/* 对话框 */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-6">{message}</div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`
              px-4 py-2 text-sm font-medium rounded-md text-white transition-colors
              disabled:cursor-not-allowed disabled:opacity-50
              ${confirmVariant === 'danger'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-primary-600 hover:bg-primary-700'}
            `}
          >
            {loading ? '处理中...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
