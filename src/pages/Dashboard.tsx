/**
 * Dashboard 仪表盘页面
 * 提供全局配置概览和快速操作入口
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from '../api/client';
import { Card } from '../components/common/Card';
import { StatsCard } from '../components/common/StatsCard';
import { Button } from '../components/common/Button';
import { PageSkeleton } from '../components/common/Skeleton';
import { JsonPreview } from '../components/common/JsonPreview';
import { BackupManager } from './advanced/BackupManager';
import { ImportWizard } from './advanced/ImportWizard';
import { Toast } from '../components/common/Toast';
import { useNotification } from '../hooks/useNotification';

interface DashboardStats {
  providers: number;
  agents: number;
  tools: number;
  skills: number;
  mcp: number;
  hooks: number;
  plugins: number;
  instructions: number;
  commands: number;
  backups: number;
}

export function Dashboard() {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const { notifications, error: notifyError, remove } = useNotification();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await get<{ config: Record<string, unknown> }>('/config');
      setConfig(data.config);
      const c = data.config;
      const providerCount = c.provider ? Object.keys(c.provider as Record<string, unknown>).length : 0;
      const agentCount = c.agent ? Object.keys(c.agent as Record<string, unknown>).length : 0;
      const toolCount = c.tools ? Object.keys(c.tools as Record<string, unknown>).length : 0;
      const skillCount = c.skills ? Object.keys(c.skills as Record<string, unknown>).length : 0;
      const mcpCount = c.mcp ? Object.keys(c.mcp as Record<string, unknown>).length : 0;
      const hookCount = c.hook ? Object.keys(c.hook as Record<string, unknown>).length : 0;
      const pluginCount = Array.isArray(c.plugin) ? c.plugin.length : 0;
      const instructionCount = Array.isArray(c.instructions) ? c.instructions.length : 0;
      const commandCount = c.command ? Object.keys(c.command as Record<string, unknown>).length : 0;

      let backupCount = 0;
      try {
        const b = await get<{ backups: unknown[] }>('/config/backups');
        backupCount = (b.backups || []).length;
      } catch { /* ignore */ }

      setStats({ providers: providerCount, agents: agentCount, tools: toolCount, skills: skillCount, mcp: mcpCount, hooks: hookCount, plugins: pluginCount, instructions: instructionCount, commands: commandCount, backups: backupCount });
    } catch { notifyError('加载配置失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">仪表盘</h1>
          <p className="text-sm text-gray-500 mt-1">配置概览与快速操作</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon="refresh" onClick={load}>刷新</Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard title="提供商" value={stats?.providers ?? 0} icon="cloud" onClick={() => navigate('/providers')} />
        <StatsCard title="代理" value={stats?.agents ?? 0} icon="smart_toy" onClick={() => navigate('/agents')} />
        <StatsCard title="工具" value={stats?.tools ?? 0} icon="construction" onClick={() => navigate('/tools')} />
        <StatsCard title="技能" value={stats?.skills ?? 0} icon="psychology" onClick={() => navigate('/skills')} />
        <StatsCard title="MCP 服务器" value={stats?.mcp ?? 0} icon="dns" onClick={() => navigate('/mcp')} />
        <StatsCard title="钩子" value={stats?.hooks ?? 0} icon="sync" onClick={() => navigate('/hooks')} />
        <StatsCard title="插件" value={stats?.plugins ?? 0} icon="extension" onClick={() => navigate('/plugins')} />
        <StatsCard title="指令引用" value={stats?.instructions ?? 0} icon="description" onClick={() => navigate('/instructions')} />
        <StatsCard title="自定义命令" value={stats?.commands ?? 0} icon="terminal" onClick={() => navigate('/commands')} />
        <StatsCard title="配置备份" value={stats?.backups ?? 0} icon="backup" onClick={() => setActiveSection(activeSection === 'backups' ? null : 'backups')} />
      </div>

      {/* 可折叠操作区域 */}
      {activeSection === 'backups' && <BackupManager />}

      {activeSection === 'import' && (
        <ImportWizard currentConfig={config} onComplete={load} />
      )}

      {/* JSON 实时预览 */}
      <Card title="配置预览">
        <JsonPreview data={config} defaultExpanded={false} title="当前配置" autoRefresh />
      </Card>

      {/* 快速入口 */}
      <Card title="快速操作">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Button variant="ghost" icon="cloud" onClick={() => navigate('/providers')}>提供商</Button>
          <Button variant="ghost" icon="smart_toy" onClick={() => navigate('/agents')}>代理</Button>
          <Button variant="ghost" icon="construction" onClick={() => navigate('/tools')}>工具</Button>
          <Button variant="ghost" icon="psychology" onClick={() => navigate('/skills')}>技能</Button>
          <Button variant="ghost" icon="dns" onClick={() => navigate('/mcp')}>MCP</Button>
          <Button variant="ghost" icon="lock" onClick={() => navigate('/permissions')}>权限</Button>
          <Button variant="ghost" icon="keyboard" onClick={() => navigate('/keybinds')}>快捷键</Button>
          <Button variant="ghost" icon="settings" onClick={() => navigate('/advanced')}>高级</Button>
          <Button variant="ghost" icon="code" onClick={() => navigate('/raw')}>JSON</Button>
          <Button variant="ghost" icon="sync" onClick={() => navigate('/hooks')}>钩子</Button>
          <Button variant="ghost" icon="extension" onClick={() => navigate('/plugins')}>插件</Button>
          <Button variant="ghost" icon="file_upload" onClick={() => setActiveSection(activeSection === 'import' ? null : 'import')}>导入</Button>
        </div>
      </Card>

      <Toast notifications={notifications} onRemove={remove} />
    </div>
  );
}
