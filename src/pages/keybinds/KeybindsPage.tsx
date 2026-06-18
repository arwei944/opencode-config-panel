import { useState, useEffect, useCallback } from 'react';
import { get, patch } from '../../api/client';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { EmptyState } from '../../components/common/EmptyState';
import { Toast } from '../../components/common/Toast';
import { useNotification } from '../../hooks/useNotification';

const DEFAULT_KEYBINDS: Record<string, string> = {
  'input.submit': 'Enter', 'input.newline': 'Shift+Enter', 'input.cancel': 'Escape',
  'panel.toggle': 'Ctrl+`', 'sidebar.toggle': 'Ctrl+B', 'search.toggle': 'Ctrl+F',
  'chat.new': 'Ctrl+N', 'zoom.in': 'Ctrl+=', 'zoom.out': 'Ctrl+-', 'zoom.reset': 'Ctrl+0',
};

export function KeybindsPage() {
  const [keybinds, setKeybinds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const { notifications, success, error: notifyError, remove } = useNotification();

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await get<{ config: { keybinds?: Record<string, string> } }>('/config'); setKeybinds(d.config.keybinds || {}); }
    catch { notifyError('加载失败'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleChange(key: string, value: string) {
    const updated = { ...keybinds, [key]: value };
    setKeybinds(updated);
    try { await patch('/config', { keybinds: updated }); }
    catch { notifyError('保存失败'); load(); }
  }

  async function handleReset() {
    try { await patch('/config', { keybinds: DEFAULT_KEYBINDS }); setKeybinds(DEFAULT_KEYBINDS); success('已恢复默认快捷键'); }
    catch { notifyError('重置失败'); }
  }

  if (loading) return <Loading text="加载中..." />;
  const allKeys = [...new Set([...Object.keys(DEFAULT_KEYBINDS), ...Object.keys(keybinds)])];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">快捷键绑定</h1><p className="text-sm text-gray-500 mt-1">自定义键盘快捷键</p></div>
        <Button variant="outline" onClick={handleReset}>恢复默认</Button>
      </div>
      <Card>
        {allKeys.length === 0 ? <EmptyState icon="keyboard" title="无快捷键配置" /> : (
          <div className="space-y-2">
            {allKeys.map(key => (
              <div key={key} className="flex items-center gap-4 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <span className="text-sm font-mono text-gray-600 dark:text-gray-400 w-48">{key}</span>
                <Input value={keybinds[key] || ''} onChange={e => handleChange(key, e.target.value)} placeholder="按键组合" className="flex-1" />
              </div>
            ))}
          </div>
        )}
      </Card>
      <Toast notifications={notifications} onRemove={remove} />
    </div>
  );
}
