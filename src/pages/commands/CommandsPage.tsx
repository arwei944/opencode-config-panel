import { useState, useEffect, useCallback } from 'react';
import { get, patch } from '../../api/client';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Loading } from '../../components/common/Loading';
import { EmptyState } from '../../components/common/EmptyState';
import { Toast } from '../../components/common/Toast';
import { useNotification } from '../../hooks/useNotification';
import type { CommandConfig } from '../../types/config';

export function CommandsPage() {
  const [commands, setCommands] = useState<Record<string, CommandConfig>>({});
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newTemplate, setNewTemplate] = useState('');
  const { notifications, success, error: notifyError, remove } = useNotification();

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await get<{ config: { command?: Record<string, CommandConfig> } }>('/config'); setCommands(d.config.command || {}); }
    catch { notifyError('加载失败'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!newName.trim() || !newTemplate.trim()) return;
    const updated = { ...commands, [newName.trim()]: { template: newTemplate.trim() } };
    try { await patch('/config', { command: updated }); success('命令已添加'); setNewName(''); setNewTemplate(''); load(); }
    catch (e) { notifyError((e as Error).message); }
  }

  async function handleDelete(name: string) {
    const { [name]: _, ...rest } = commands;
    try { await patch('/config', { command: rest }); success('命令已删除'); load(); }
    catch (e) { notifyError((e as Error).message); }
  }

  if (loading) return <Loading text="加载中..." />;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">自定义命令</h1>
      <Card title="已定义命令">
        {Object.keys(commands).length === 0 ? <EmptyState icon="terminal" title="暂无自定义命令" /> : (
          <div className="space-y-2">
            {Object.entries(commands).map(([name, cfg]) => (
              <div key={name} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800">
                <div><span className="text-sm font-mono font-medium">{name}</span><p className="text-xs text-gray-500 font-mono mt-0.5">{cfg.template}</p></div>
                <Button size="sm" variant="ghost" icon="delete" onClick={() => handleDelete(name)} />
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card title="添加命令">
        <div className="space-y-3">
          <Input label="命令名称" value={newName} onChange={e => setNewName(e.target.value)} placeholder="my-command" />
          <Input label="模板" value={newTemplate} onChange={e => setNewTemplate(e.target.value)} placeholder="git commit -m '{message}'" />
          <Button onClick={handleAdd}>添加</Button>
        </div>
      </Card>
      <Toast notifications={notifications} onRemove={remove} />
    </div>
  );
}
