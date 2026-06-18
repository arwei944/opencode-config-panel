import { useState, useEffect, useCallback } from 'react';
import { get, patch } from '../../api/client';
import { Card } from '../../components/common/Card';
import { Select } from '../../components/common/Select';
import { Loading } from '../../components/common/Loading';
import { Toast } from '../../components/common/Toast';
import { useNotification } from '../../hooks/useNotification';
import type { PermissionAction } from '../../types/config';

const ACTION_OPTIONS = [
  { value: 'ask', label: '每次询问 (ask)' },
  { value: 'allow', label: '允许 (allow)' },
  { value: 'deny', label: '拒绝 (deny)' },
];

const TOOLS = ['read', 'edit', 'glob', 'grep', 'bash', 'task', 'webfetch', 'websearch', 'todowrite', 'question', 'skill', 'lsp', 'doom_loop', 'external_directory'];

export function PermissionsPage() {
  const [permissions, setPermissions] = useState<Record<string, PermissionAction>>({});
  const [loading, setLoading] = useState(true);
  const { notifications, success, error: notifyError, remove } = useNotification();

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await get<{ config: { permission?: Record<string, PermissionAction> } }>('/config'); setPermissions(d.config.permission || {}); }
    catch { notifyError('加载失败'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleChange(tool: string, value: string) {
    const updated = { ...permissions, [tool]: value as PermissionAction };
    setPermissions(updated);
    try { await patch('/config', { permission: updated }); success(`${tool} 权限已更新`); }
    catch (e) { notifyError((e as Error).message); load(); }
  }

  if (loading) return <Loading text="加载中..." />;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">权限配置</h1>
      <p className="text-sm text-gray-500">设置每个工具的默认权限策略</p>
      <Card>
        <div className="space-y-3">
          {TOOLS.map(tool => (
            <div key={tool} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <span className="text-sm font-mono font-medium">{tool}</span>
              <Select options={ACTION_OPTIONS} value={permissions[tool] || 'ask'} onChange={e => handleChange(tool, e.target.value)} className="w-48" />
            </div>
          ))}
        </div>
      </Card>
      <Toast notifications={notifications} onRemove={remove} />
    </div>
  );
}
