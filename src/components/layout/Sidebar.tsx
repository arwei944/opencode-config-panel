/**
 * 侧边导航组件
 * 图标 + 文字，高亮当前项，可折叠
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { NAV_ITEMS, NAV_SECTIONS, APP_CONFIG } from '../../utils/constants';

interface SidebarProps {
  /** 是否折叠 */
  collapsed?: boolean;
  /** 折叠状态变更回调 */
  onCollapsedChange?: (collapsed: boolean) => void;
}

/**
 * 侧边导航栏
 * 显示分组导航、当前页面高亮、可折叠
 */
export function Sidebar({ collapsed = false, onCollapsedChange }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  function isActive(path: string): boolean {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  }

  function getNavItem(id: string) {
    return NAV_ITEMS.find(item => item.label === id);
  }

  return (
    <aside
      className={`
        fixed left-0 top-0 h-screen bg-white dark:bg-gray-900
        border-r border-gray-200 dark:border-gray-800
        flex flex-col transition-all duration-300 z-30
        ${collapsed ? 'w-16' : 'w-60'}
      `}
    >
      {/* 标题区域 */}
      <div className="flex items-center h-14 px-4 border-b border-gray-200 dark:border-gray-800">
        {!collapsed && (
          <h1 className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{APP_CONFIG.name}</h1>
        )}
        <button
          type="button"
          onClick={() => onCollapsedChange?.(!collapsed)}
          className={`p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 ${collapsed ? 'mx-auto' : 'ml-auto'}`}
          title={collapsed ? '展开侧边栏' : '折叠侧边栏'}
        >
          <span className="icon text-xl leading-none">{collapsed ? 'menu' : 'chevron_left'}</span>
        </button>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {NAV_SECTIONS.map(section => {
          const sectionItems = section.items.map(id => getNavItem(id)).filter(Boolean) as typeof NAV_ITEMS;
          if (sectionItems.length === 0) return null;

          return (
            <div key={section.title}>
              {!collapsed && (
                <p className="px-2 mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {section.title}
                </p>
              )}
              <div className="space-y-0.5">
                {sectionItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className={`
                      w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm font-medium transition-colors
                      ${isActive(item.path)
                        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                      }
                      ${collapsed ? 'justify-center px-0' : ''}
                    `}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="icon text-xl leading-none">{item.icon}</span>
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {item.badge && !collapsed && (
                      <span className="ml-auto text-xs bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* 底部版本信息 */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
          <p className="text-xs text-gray-400">v{APP_CONFIG.version}</p>
        </div>
      )}
    </aside>
  );
}
