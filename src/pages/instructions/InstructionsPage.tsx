import { useState, useEffect, useCallback } from 'react';
import { get, patch } from '../../api/client';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Loading } from '../../components/common/Loading';
import { EmptyState } from '../../components/common/EmptyState';
import { MarkdownPreview } from '../../components/common/MarkdownPreview';
import { Toast } from '../../components/common/Toast';
import { useNotification } from '../../hooks/useNotification';

export function InstructionsPage() {
  const [instructions, setInstructions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPath, setNewPath] = useState('');
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const { notifications, success, error: notifyError, remove } = useNotification();

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await get<{ config: { instructions?: string[] } }>('/config'); setInstructions(d.config.instructions || []); }
    catch { notifyError('加载失败'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!newPath.trim()) return;
    try { await patch('/config', { instructions: [...instructions, newPath.trim()] }); success('已添加'); setNewPath(''); load(); }
    catch (e) { notifyError((e as Error).message); }
  }

  async function handleDelete(index: number) {
    try { await patch('/config', { instructions: instructions.filter((_, i) => i !== index) }); success('已删除'); load(); }
    catch (e) { notifyError((e as Error).message); }
  }

  async function handleMoveUp(index: number) {
    if (index === 0) return;
    const updated = [...instructions]; [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    try { await patch('/config', { instructions: updated }); load(); }
    catch { notifyError('排序失败'); }
  }

  if (loading) return <Loading text="加载中..." />;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">指令文件</h1>
      <Card title="指令引用列表">
        {instructions.length === 0 ? <EmptyState icon="description" title="暂无引用" description="添加 AGENTS.md 或其他指令文件" /> : (
          <div className="space-y-2">
            {instructions.map((path, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800">
                <div className="flex items-center gap-2">
                  <button onClick={() => handleMoveUp(i)} className="text-gray-400 hover:text-gray-600" title="上移"><span className="icon">arrow_upward</span></button>
                  <span className="text-sm font-mono">{path}</span>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" icon="visibility" onClick={() => setPreviewIndex(previewIndex === i ? null : i)} />
                  <Button size="sm" variant="ghost" icon="delete" onClick={() => handleDelete(i)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      {previewIndex !== null && instructions[previewIndex] && (
        <Card title={`预览: ${instructions[previewIndex]}`}>
          <MarkdownPreview content="*文件内容预览（需要从文件系统读取）*" />
        </Card>
      )}
      <Card title="添加引用">
        <div className="flex gap-2">
          <Input value={newPath} onChange={e => setNewPath(e.target.value)} placeholder="AGENTS.md" className="flex-1" />
          <Button onClick={handleAdd}>添加</Button>
        </div>
      </Card>
      <Toast notifications={notifications} onRemove={remove} />
    </div>
  );
}
