/**
 * 消息提示组件
 * 显示成功、错误、警告、信息四种类型的通知
 */

import type { Notification, NotificationType } from '../../hooks/useNotification';

interface ToastProps {
  /** 通知列表 */
  notifications: Notification[];
  /** 移除通知回调 */
  onRemove: (id: string) => void;
}

const typeStyles: Record<NotificationType, { bg: string; icon: string; border: string }> = {
  success: { bg: 'bg-green-50 dark:bg-green-900/30', icon: 'check_circle', border: 'border-green-400' },
  error: { bg: 'bg-red-50 dark:bg-red-900/30', icon: 'error', border: 'border-red-400' },
  warning: { bg: 'bg-yellow-50 dark:bg-yellow-900/30', icon: 'warning', border: 'border-yellow-400' },
  info: { bg: 'bg-blue-50 dark:bg-blue-900/30', icon: 'info', border: 'border-blue-400' },
};

/**
 * 消息提示组件
 * @example
 * <Toast notifications={notifications} onRemove={remove} />
 */
export function Toast({ notifications, onRemove }: ToastProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {notifications.map(notification => {
        const style = typeStyles[notification.type];
        return (
          <div
            key={notification.id}
            className={`
              flex items-start gap-2 px-4 py-3 rounded-lg border shadow-lg
              ${style.bg} ${style.border}
              animate-slide-in
            `}
            role="alert"
          >
            <span className="icon text-xl leading-none mt-0.5">{style.icon}</span>
            <p className="flex-1 text-sm text-gray-800 dark:text-gray-200">{notification.message}</p>
            <button
              type="button"
              onClick={() => onRemove(notification.id)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="关闭通知"
            >
              <span className="icon text-lg leading-none">close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
