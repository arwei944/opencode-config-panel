/**
 * 顶部栏组件
 * 面包屑导航 + 配置状态指示器 + 操作按钮
 */

import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { NAV_ITEMS } from '../../utils/constants';
import { get } from '../../api/client';

interface TopBarProps {
  /** 侧边栏是否折叠 */
  sidebarCollapsed: boolean;
  /** 主题切换回调 */
  onToggleTheme?: () => void;
  /** 是否暗色模式 */
  isDark?: boolean;
}

type ConfigStatus = 'saved' | 'modified' | 'loading' | 'error';

/**
 * 顶部操作栏
 * 显示当前页面路径、配置状态和全局操作按钮
 */
export function TopBar({ sidebarCollapsed, onToggleTheme, isDark }: TopBarProps) {
  const location = useLocation();
  const [status, setStatus] = useState<ConfigStatus>('loading');
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // 根据路径匹配当前导航项
  const currentItem = NAV_ITEMS.find(
    item => location.pathname === item.path || location.pathname.startsWith(item.path + '/'),
  );

  const checkStatus = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await get<{ lastSaved?: string }>('/config');
      setStatus('saved');
      if (data.lastSaved) setLastSaved(data.lastSaved);
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const statusConfig = {
    saved: { color: 'bg-green-400', text: '已保存' },
    modified: { color: 'bg-yellow-400', text: '未保存' },
    loading: { color: 'bg-gray-300 dark:bg-gray-600', text: '检测中...' },
    error: { color: 'bg-red-400', text: '连接异常' },
  }[status];

  return (
    <header
      className={`
        fixed top-0 right-0 h-14 bg-white dark:bg-gray-900
        border-b border-gray-200 dark:border-gray-800
        flex items-center justify-between px-6
        transition-all duration-300 z-20
        ${sidebarCollapsed ? 'left-16' : 'left-60'}
      `}
    >
      {/* 面包屑 */}
      <div className="flex items-center gap-2 text-sm min-w-0">
        <span className="text-gray-400 shrink-0">opencode</span>
        {currentItem && (
          <>
            <span className="text-gray-300 dark:text-gray-600 shrink-0">/</span>
            <span className="font-medium text-gray-700 dark:text-gray-300 truncate">{currentItem.label}</span>
          </>
        )}
      </div>

      {/* 右侧操作按钮 */}
      <div className="flex items-center gap-3 shrink-0">
        {/* 配置状态指示 */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400" title={lastSaved ? `上次保存: ${new Date(lastSaved).toLocaleString('zh-CN')}` : undefined}>
          <span className={`w-2 h-2 rounded-full ${statusConfig.color} ${status === 'loading' ? 'animate-pulse' : ''}`} />
          {statusConfig.text}
        </div>

        {/* 分隔线 */}
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />

        {/* 主题切换 */}
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title={isDark ? '切换亮色模式' : '切换暗色模式'}
          >
            <span className="icon text-xl leading-none">{isDark ? 'light_mode' : 'dark_mode'}</span>
          </button>
        )}
      </div>
    </header>
  );
}
