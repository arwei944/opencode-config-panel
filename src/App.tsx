/**
 * 应用根组件
 * 定义全局路由分发，使用 AppLayout 包裹
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProvidersPage } from './pages/providers/ProvidersPage';
import { ToolsPage } from './pages/tools/ToolsPage';
import { HooksPage } from './pages/hooks/HooksPage';
import { AgentsPage } from './pages/agents/AgentsPage';
import { SkillsPage } from './pages/skills/SkillsPage';
import { McpPage } from './pages/mcp/McpPage';
import { PluginsPage } from './pages/plugins/PluginsPage';
import { PermissionsPage } from './pages/permissions/PermissionsPage';
import { KeybindsPage } from './pages/keybinds/KeybindsPage';
import { CommandsPage } from './pages/commands/CommandsPage';
import { InstructionsPage } from './pages/instructions/InstructionsPage';
import { AdvancedPage } from './pages/advanced/AdvancedPage';
import { RawEditorPage } from './pages/raw/RawEditorPage';
import { Dashboard } from './pages/Dashboard';
import { NotFoundPage } from './pages/NotFoundPage';
import { ErrorBoundary } from './components/common/ErrorBoundary';

/**
 * 应用根组件
 */
function App() {
  return (
    <ErrorBoundary>
      <AppLayout>
        <Routes>
          {/* 默认重定向 */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 仪表盘 */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* 配置管理 */}
          <Route path="/providers" element={<ProvidersPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/mcp" element={<McpPage />} />

          {/* 扩展 */}
          <Route path="/hooks" element={<HooksPage />} />
          <Route path="/plugins" element={<PluginsPage />} />

          {/* 系统 */}
          <Route path="/permissions" element={<PermissionsPage />} />
          <Route path="/keybinds" element={<KeybindsPage />} />
          <Route path="/commands" element={<CommandsPage />} />
          <Route path="/instructions" element={<InstructionsPage />} />
          <Route path="/advanced" element={<AdvancedPage />} />

          {/* 开发 */}
          <Route path="/raw" element={<RawEditorPage />} />

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppLayout>
    </ErrorBoundary>
  );
}

export default App;
