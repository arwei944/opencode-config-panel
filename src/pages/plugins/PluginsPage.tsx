import { useState, useEffect, useCallback } from 'react';
import { get, patch } from '../../api/client';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Loading } from '../../components/common/Loading';
import { EmptyState } from '../../components/common/EmptyState';
import { SearchInput } from '../../components/common/SearchInput';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Badge } from '../../components/common/Badge';
import { Toast } from '../../components/common/Toast';
import { useNotification } from '../../hooks/useNotification';

export function PluginsPage() {
  const [plugins, setPlugins] = useState<(string | [string, Record<string, unknown>])[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPlugin, setNewPlugin] = useState('');
  const [search, setSearch] = useState('');

  // 编辑状态
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editConfig, setEditConfig] = useState('');

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const { notifications, success, error: notifyError, remove } = useNotification();

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await get<{ config: { plugin?: (string | [string, Record<string, unknown>])[] } }>('/config'); setPlugins(d.config.plugin || []); }
    catch { notifyError('加载失败'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function savePlugins(updated: (string | [string, Record<string, unknown>])[]) {
    await patch('/config', { plugin: updated });
    setPlugins(updated);
  }

  async function handleAdd() {
    if (!newPlugin.trim()) return;
    const name = newPlugin.trim();
    if (plugins.some(p => (typeof p === 'string' ? p : p[0]) === name)) {
      notifyError('插件已存在');
      return;
    }
    try {
      await savePlugins([...plugins, name]);
      success('插件已添加'); setNewPlugin(''); load();
    } catch (e) { notifyError((e as Error).message); }
  }

  async function handleDelete(index: number) {
    try {
      const updated = plugins.filter((_, i) => i !== index);
      await savePlugins(updated);
      success('插件已删除'); load();
    } catch (e) { notifyError((e as Error).message); }
    setDeleteTarget(null);
  }

  function openEdit(index: number, p: string | [string, Record<string, unknown>]) {
    setEditIndex(index);
    const name = typeof p === 'string' ? p : p[0];
    const config = typeof p === 'string' ? '' : JSON.stringify(p[1], null, 2);
    setEditName(name);
    setEditConfig(config);
  }

  async function handleSaveEdit() {
    if (editIndex === null || !editName.trim()) return;
    try {
      const updated = [...plugins];
      let entry: string | [string, Record<string, unknown>] = editName.trim();
      if (editConfig.trim()) {
        entry = [editName.trim(), JSON.parse(editConfig)];
      }
      updated[editIndex] = entry;
      await savePlugins(updated);
      success('插件已更新'); setEditIndex(null); load();
    } catch (e) {
      notifyError('配置 JSON 格式错误: ' + (e as Error).message);
    }
  }

  const filtered = plugins.filter(p => {
    if (!search) return true;
    const name = typeof p === 'string' ? p : p[0];
    return name.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) return <Loading text="加载中..." />;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">插件管理</h1>

      <Card title={`已安装插件 (${plugins.length})`}>
        <div className="mb-4">
          <SearchInput onSearch={setSearch} placeholder="搜索插件..." />
        </div>
        {filtered.length === 0 ? <EmptyState icon="extension" title={search ? '无匹配插件' : '暂无插件'} /> : (
          <div className="space-y-2">
            {filtered.map((p) => {
              const origIndex = plugins.indexOf(p);
              const name = typeof p === 'string' ? p : p[0];
              const hasConfig = typeof p !== 'string';

              if (editIndex === origIndex) {
                return (
                  <div key={origIndex} className="flex flex-col gap-3 p-3 rounded-md border border-primary-300 dark:border-primary-700 bg-primary-50/30 dark:bg-primary-900/10">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="插件名称" className="text-sm py-1" />
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="primary" icon="check" onClick={handleSaveEdit}>保存</Button>
                        <Button size="sm" variant="ghost" icon="close" onClick={() => setEditIndex(null)}>取消</Button>
                      </div>
                    </div>
                    <Input
                      label="配置 (JSON)"
                      value={editConfig}
                      onChange={e => setEditConfig(e.target.value)}
                      placeholder='{"key": "value"}'
                      helpText="留空则视为简单字符串插件"
                    />
                  </div>
                );
              }

              return (
                <div key={origIndex} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 group">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">{name}</span>
                    {hasConfig && <Badge variant="default" size="sm">有配置</Badge>}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                    <Button size="sm" variant="ghost" icon="edit" onClick={() => openEdit(origIndex, p)} />
                    <Button size="sm" variant="ghost" icon="delete" onClick={() => setDeleteTarget(origIndex)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="添加插件">
        <div className="flex gap-2">
          <Input value={newPlugin} onChange={e => setNewPlugin(e.target.value)} placeholder="插件名称或 npm 包名" className="flex-1" />
          <Button onClick={handleAdd}>添加</Button>
        </div>
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="确认删除插件"
        message={`确定要删除插件 "${deleteTarget !== null && (typeof plugins[deleteTarget] === 'string' ? plugins[deleteTarget] : (plugins[deleteTarget] as [string, unknown])[0])}" 吗？`}
        confirmText="删除"
        confirmVariant="danger"
        onConfirm={() => deleteTarget !== null && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />

      <Toast notifications={notifications} onRemove={remove} />
    </div>
  );
}
