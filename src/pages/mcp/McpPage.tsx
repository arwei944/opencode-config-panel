import { useState, useEffect, useCallback } from 'react';
import { fetchMcpServers, deleteMcpServer } from '../../api/mcp';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Loading } from '../../components/common/Loading';
import { EmptyState } from '../../components/common/EmptyState';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Toast } from '../../components/common/Toast';
import { useNotification } from '../../hooks/useNotification';
import { McpEditorModal } from './McpEditorModal';

export function McpPage() {
  const [servers, setServers] = useState<Record<string, Record<string, unknown>>>({});
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<{ name: string; config: Record<string, unknown> } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { notifications, success, error: notifyError, remove } = useNotification();

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await fetchMcpServers(); setServers(d.servers as Record<string, Record<string, unknown>>); }
    catch { notifyError('加载失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(name: string) {
    try { await deleteMcpServer(name); success(`已删除 ${name}`); load(); }
    catch (e) { notifyError((e as Error).message); }
    setDeleteTarget(null);
  }

  if (loading) return <Loading text="加载 MCP 服务器..." />;

  const entries = Object.entries(servers);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">MCP 服务器</h1>
          <p className="text-sm text-gray-500 mt-1">管理 Model Context Protocol 服务器</p>
        </div>
        <Button onClick={() => { setEditingServer(null); setEditorOpen(true); }} icon="add">添加服务器</Button>
      </div>

      {entries.length === 0 ? (
        <Card><EmptyState icon="dns" title="暂无 MCP 服务器" action={<Button onClick={() => setEditorOpen(true)}>添加服务器</Button>} /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {entries.map(([name, cfg]) => {
            const type = (cfg.type as string) || (cfg.command ? 'local' : 'remote');
            const isEnabled = cfg.enabled !== false;
            return (
              <Card key={name}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{name}</h3>
                      <Badge variant={type === 'local' ? 'info' : 'primary'} size="sm">{type}</Badge>
                      <Badge variant={isEnabled ? 'success' : 'warning'} size="sm">{isEnabled ? '启用' : '禁用'}</Badge>
                    </div>
                    {type === 'local' ? (
                      <p className="text-xs font-mono text-gray-500">{(cfg.command as string[])?.join(' ') || ''}</p>
                    ) : (
                      <p className="text-xs font-mono text-gray-500">{cfg.url as string}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" icon="edit" onClick={() => { setEditingServer({ name, config: cfg }); setEditorOpen(true); }} />
                    <Button size="sm" variant="ghost" icon="delete" onClick={() => setDeleteTarget(name)} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editorOpen && <McpEditorModal open={editorOpen} initial={editingServer} onSaved={() => { setEditorOpen(false); load(); }} onClose={() => setEditorOpen(false)} />}
      <ConfirmDialog open={!!deleteTarget} title="确认删除" message={`删除 MCP 服务器 "${deleteTarget}"？`} confirmVariant="danger" confirmText="删除" onConfirm={() => deleteTarget && handleDelete(deleteTarget)} onCancel={() => setDeleteTarget(null)} />
      <Toast notifications={notifications} onRemove={remove} />
    </div>
  );
}
