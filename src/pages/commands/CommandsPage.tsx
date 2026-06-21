import { useState, useEffect, useCallback } from 'react';
import { get, patch } from '../../api/client';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Loading } from '../../components/common/Loading';
import { EmptyState } from '../../components/common/EmptyState';
import { SearchInput } from '../../components/common/SearchInput';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Toast } from '../../components/common/Toast';
import { useNotification } from '../../hooks/useNotification';
import type { CommandConfig } from '../../types/config';

export function CommandsPage() {
  const [commands, setCommands] = useState<Record<string, CommandConfig>>({});
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newTemplate, setNewTemplate] = useState('');
  const [search, setSearch] = useState('');

  // 编辑状态
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTemplate, setEditTemplate] = useState('');

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { notifications, success, error: notifyError, remove } = useNotification();

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await get<{ config: { command?: Record<string, CommandConfig> } }>('/config'); setCommands(d.config.command || {}); }
    catch { notifyError('加载失败'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!newName.trim() || !newTemplate.trim()) return;
    if (commands[newName.trim()]) { notifyError('命令名称已存在'); return; }
    const updated = { ...commands, [newName.trim()]: { template: newTemplate.trim() } };
    try { await patch('/config', { command: updated }); success('命令已添加'); setNewName(''); setNewTemplate(''); load(); }
    catch (e) { notifyError((e as Error).message); }
  }

  async function handleDelete(name: string) {
    const { [name]: _, ...rest } = commands;
    try { await patch('/config', { command: rest }); success('命令已删除'); load(); }
    catch (e) { notifyError((e as Error).message); }
    setDeleteTarget(null);
  }

  function startEdit(name: string, cfg: CommandConfig) {
    setEditKey(name);
    setEditName(name);
    setEditTemplate(cfg.template);
  }

  async function handleSaveEdit() {
    if (!editKey || !editTemplate.trim()) return;
    const updated = { ...commands };
    if (editName !== editKey) {
      // 重命名
      delete updated[editKey];
    }
    updated[editName] = { template: editTemplate.trim() };
    try { await patch('/config', { command: updated }); success('命令已更新'); setEditKey(null); load(); }
    catch (e) { notifyError((e as Error).message); }
  }

  const filtered = Object.entries(commands).filter(([name]) =>
    !search || name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Loading text="加载中..." />;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">自定义命令</h1>

      <Card title={`已定义命令 (${Object.keys(commands).length})`}>
        <div className="mb-4">
          <SearchInput onSearch={setSearch} placeholder="搜索命令..." />
        </div>
        {filtered.length === 0 ? <EmptyState icon="terminal" title={search ? '无匹配命令' : '暂无自定义命令'} /> : (
          <div className="space-y-2">
            {filtered.map(([name, cfg]) => (
              editKey === name ? (
                <div key={name} className="flex items-center gap-3 p-3 rounded-md border border-primary-300 dark:border-primary-700 bg-primary-50/30 dark:bg-primary-900/10">
                  <div className="flex-1 space-y-2">
                    <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="命令名称" className="text-sm py-1" />
                    <Input value={editTemplate} onChange={e => setEditTemplate(e.target.value)} placeholder="模板" className="text-sm py-1" />
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="primary" icon="check" onClick={handleSaveEdit}>保存</Button>
                    <Button size="sm" variant="ghost" icon="close" onClick={() => setEditKey(null)}>取消</Button>
                  </div>
                </div>
              ) : (
                <div key={name} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 group">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">{name}</span>
                    <p className="text-xs text-gray-500 font-mono mt-0.5 truncate">{cfg.template}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                    <Button size="sm" variant="ghost" icon="edit" onClick={() => startEdit(name, cfg)} />
                    <Button size="sm" variant="ghost" icon="delete" onClick={() => setDeleteTarget(name)} />
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </Card>

      <Card title="添加命令">
        <div className="space-y-3">
          <Input label="命令名称" value={newName} onChange={e => setNewName(e.target.value)} placeholder="my-command" helpText="小写字母、数字、连字符" />
          <Input label="模板" value={newTemplate} onChange={e => setNewTemplate(e.target.value)} placeholder="git commit -m '{message}'" helpText="使用 {变量名} 定义参数占位符" />
          <Button onClick={handleAdd}>添加</Button>
        </div>
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        title="确认删除命令"
        message={`确定要删除命令 "${deleteTarget}" 吗？`}
        confirmText="删除"
        confirmVariant="danger"
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />

      <Toast notifications={notifications} onRemove={remove} />
    </div>
  );
}
