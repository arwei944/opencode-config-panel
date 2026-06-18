import { useState, useEffect, useCallback } from 'react';
import { get, put } from '../../api/client';
import { CodeEditor } from '../../components/common/CodeEditor';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Loading } from '../../components/common/Loading';
import { Toast } from '../../components/common/Toast';
import { useNotification } from '../../hooks/useNotification';

export function RawEditorPage() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { notifications, success, error: notifyError, remove } = useNotification();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await get<{ config: Record<string, unknown> }>('/config');
      setContent(JSON.stringify(d.config, null, 2));
    } catch { notifyError('加载失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      const parsed = JSON.parse(content);
      await put('/config', parsed);
      success('配置已保存');
    } catch (err) {
      if (err instanceof SyntaxError) setError('JSON 格式错误: ' + err.message);
      else notifyError((err as Error).message);
    }
    finally { setSaving(false); }
  }

  function handleFormat() {
    try { setContent(JSON.stringify(JSON.parse(content), null, 2)); }
    catch { setError('无法格式化：JSON 格式错误'); }
  }

  if (loading) return <Loading text="加载中..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">JSON 编辑器</h1>
          <p className="text-sm text-gray-500 mt-1">直接编辑 opencode.json 原始内容</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleFormat} icon="format_align_left">格式化</Button>
          <Button onClick={handleSave} loading={saving} icon="save">保存</Button>
        </div>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Card padding="none">
        <CodeEditor value={content} onChange={setContent} language="json" minHeight={500} />
      </Card>
      <Toast notifications={notifications} onRemove={remove} />
    </div>
  );
}
