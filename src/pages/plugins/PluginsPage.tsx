import { useState, useEffect, useCallback } from 'react';
import { get, patch } from '../../api/client';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Loading } from '../../components/common/Loading';
import { EmptyState } from '../../components/common/EmptyState';
import { Toast } from '../../components/common/Toast';
import { useNotification } from '../../hooks/useNotification';

export function PluginsPage() {
  const [plugins, setPlugins] = useState<(string | [string, Record<string, unknown>])[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPlugin, setNewPlugin] = useState('');
  const { notifications, success, error: notifyError, remove } = useNotification();

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await get<{ config: { plugin?: (string | [string, Record<string, unknown>])[] } }>('/config'); setPlugins(d.config.plugin || []); }
    catch { notifyError('加载失败'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!newPlugin.trim()) return;
    try {
      await patch('/config', { plugin: [...plugins, newPlugin.trim()] });
      success('插件已添加'); setNewPlugin(''); load();
    } catch (e) { notifyError((e as Error).message); }
  }

  async function handleDelete(index: number) {
    try {
      const updated = plugins.filter((_, i) => i !== index);
      await patch('/config', { plugin: updated });
      success('插件已删除'); load();
    } catch (e) { notifyError((e as Error).message); }
  }

  if (loading) return <Loading text="加载中..." />;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">插件管理</h1>
      <Card title="已安装插件">
        {plugins.length === 0 ? <EmptyState icon="extension" title="暂无插件" /> : (
          <div className="space-y-2">
            {plugins.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800">
                <span className="text-sm font-mono">{typeof p === 'string' ? p : p[0]}</span>
                <Button size="sm" variant="ghost" icon="delete" onClick={() => handleDelete(i)} />
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card title="添加插件">
        <div className="flex gap-2">
          <Input value={newPlugin} onChange={e => setNewPlugin(e.target.value)} placeholder="插件名称或 npm 包名" className="flex-1" />
          <Button onClick={handleAdd}>添加</Button>
        </div>
      </Card>
      <Toast notifications={notifications} onRemove={remove} />
    </div>
  );
}
