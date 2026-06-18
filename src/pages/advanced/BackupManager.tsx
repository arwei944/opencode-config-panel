/**
 * 配置备份管理组件
 * 浏览、恢复和删除配置备份
 */

import { useState, useEffect, useCallback } from 'react';
import { get, post, del } from '../../api/client';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { EmptyState } from '../../components/common/EmptyState';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { JsonPreview } from '../../components/common/JsonPreview';
import { Toast } from '../../components/common/Toast';
import { useNotification } from '../../hooks/useNotification';

interface BackupMeta {
  id: string;
  filename: string;
  timestamp: string;
  size: number;
  description?: string;
}

export function BackupManager() {
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<unknown>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const { notifications, success, error: notifyError, remove } = useNotification();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await get<{ backups: BackupMeta[] }>('/config/backups');
      setBackups(data.backups || []);
    } catch { notifyError('加载备份列表失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handlePreview(id: string) {
    if (previewId === id) { setPreviewId(null); setPreviewData(null); return; }
    setPreviewId(id);
    try {
      const data = await get<{ config: unknown }>(`/config/backup/${id}`);
      setPreviewData(data.config);
    } catch { notifyError('加载备份内容失败'); setPreviewId(null); }
  }

  async function handleRestore(id: string) {
    setRestoring(true);
    try {
      await post(`/config/backup/${id}/restore`);
      success('配置已从备份恢复');
    } catch (e) { notifyError((e as Error).message); }
    finally { setRestoring(false); }
  }

  async function handleDelete(id: string) {
    try {
      await del(`/config/backup/${id}`);
      success('备份已删除');
      setDeleteTarget(null);
      load();
    } catch (e) { notifyError((e as Error).message); }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (loading) return <Loading text="加载备份列表..." />;

  return (
    <Card title="配置备份管理">
      {backups.length === 0 ? (
        <EmptyState icon="backup" title="暂无备份" description="保存配置时将自动创建备份" />
      ) : (
        <div className="space-y-2">
          {backups.map(b => (
            <div key={b.id} className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
              <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{b.filename}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(b.timestamp).toLocaleString('zh-CN')} · {formatSize(b.size)}
                    {b.description && ` · ${b.description}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" icon="visibility" onClick={() => handlePreview(b.id)}>预览</Button>
                  <Button size="sm" variant="ghost" icon="restore" onClick={() => handleRestore(b.id)} loading={restoring}>恢复</Button>
                  <Button size="sm" variant="ghost" icon="delete" onClick={() => setDeleteTarget(b.id)} />
                </div>
              </div>
              {previewId === b.id && !!previewData && (
                <div className="border-t border-gray-200 dark:border-gray-700">
                  <JsonPreview data={previewData} maxDepth={4} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="确认删除备份"
        message="删除后无法恢复，确定要删除此备份吗？"
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
      <Toast notifications={notifications} onRemove={remove} />
    </Card>
  );
}
