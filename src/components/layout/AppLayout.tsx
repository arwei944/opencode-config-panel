/**
 * 应用整体布局组件
 * 整合 Sidebar + TopBar + 内容区
 */

import { useState, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface AppLayoutProps {
  /** 页面内容 */
  children: ReactNode;
}

/**
 * 应用主布局
 * 包含侧边栏、顶部栏和可滚动内容区
 */
export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  function handleToggleTheme() {
    const newDark = !isDark;
    setIsDark(newDark);
    document.documentElement.classList.toggle('dark', newDark);
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
      <TopBar sidebarCollapsed={sidebarCollapsed} onToggleTheme={handleToggleTheme} isDark={isDark} />

      {/* 主内容区域 */}
      <main
        className={`
          pt-14 min-h-screen transition-all duration-300
          ${sidebarCollapsed ? 'ml-16' : 'ml-60'}
        `}
      >
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
