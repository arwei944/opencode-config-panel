import { useState, useCallback, useRef } from 'react';

/**
 * 通知消息管理 Hook
 * 支持成功、错误、警告、信息四种类型，自动消失
 */

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  /** 唯一标识 */
  id: string;
  /** 通知类型 */
  type: NotificationType;
  /** 消息内容 */
  message: string;
  /** 创建时间 */
  createdAt: number;
}

interface UseNotificationReturn {
  /** 当前通知列表 */
  notifications: Notification[];
  /** 添加成功通知 */
  success: (message: string) => void;
  /** 添加错误通知 */
  error: (message: string) => void;
  /** 添加警告通知 */
  warning: (message: string) => void;
  /** 添加信息通知 */
  info: (message: string) => void;
  /** 移除指定通知 */
  remove: (id: string) => void;
  /** 清除所有通知 */
  clear: () => void;
}

/** 通知自动消失时间（毫秒） */
const DEFAULT_DURATION = 4000;

/** 生成唯一 ID */
function generateId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 通知消息管理 Hook
 * @param duration 自动消失时间（毫秒），默认 4000
 */
export function useNotification(duration = DEFAULT_DURATION): UseNotificationReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const add = useCallback(
    (type: NotificationType, message: string) => {
      const id = generateId();
      const notification: Notification = { id, type, message, createdAt: Date.now() };

      setNotifications(prev => [...prev, notification]);

      // 自动消失
      const timer = setTimeout(() => {
        remove(id);
      }, duration);
      timersRef.current.set(id, timer);

      return id;
    },
    [duration, remove],
  );

  const success = useCallback((message: string) => add('success', message), [add]);
  const error = useCallback((message: string) => add('error', message), [add]);
  const warning = useCallback((message: string) => add('warning', message), [add]);
  const info = useCallback((message: string) => add('info', message), [add]);

  const clear = useCallback(() => {
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current.clear();
    setNotifications([]);
  }, []);

  return {
    notifications,
    success,
    error,
    warning,
    info,
    remove,
    clear,
  };
}
