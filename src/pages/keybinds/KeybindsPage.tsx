import { useState, useEffect, useCallback, useRef } from 'react';
import { get, patch } from '../../api/client';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { EmptyState } from '../../components/common/EmptyState';
import { Badge } from '../../components/common/Badge';
import { Toast } from '../../components/common/Toast';
import { useNotification } from '../../hooks/useNotification';

const DEFAULT_KEYBINDS: Record<string, string> = {
  'input.submit': 'Enter', 'input.newline': 'Shift+Enter', 'input.cancel': 'Escape',
  'panel.toggle': 'Ctrl+`', 'sidebar.toggle': 'Ctrl+B', 'search.toggle': 'Ctrl+F',
  'chat.new': 'Ctrl+N', 'zoom.in': 'Ctrl+=', 'zoom.out': 'Ctrl+-', 'zoom.reset': 'Ctrl+0',
};

/** 将键盘事件转换为按键串 */
function eventToKeyCombo(e: React.KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  const key = e.key === ' ' ? 'Space' : e.key;
  // 跳过单独修饰键
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return '';
  parts.push(key.length === 1 ? key.toUpperCase() : key);
  return parts.join('+');
}

export function KeybindsPage() {
  const [keybinds, setKeybinds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState<string | null>(null);
  const recordingRef = useRef<string | null>(null);
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

  function startRecording(key: string) {
    setRecording(key);
    recordingRef.current = key;
  }

  function handleKeyDown(e: React.KeyboardEvent, targetKey: string) {
    if (recording !== targetKey) return;
    e.preventDefault();
    e.stopPropagation();
    const combo = eventToKeyCombo(e);
    if (!combo) return;
    handleChange(targetKey, combo);
    setRecording(null);
    recordingRef.current = null;
  }

  /** 检测冲突：找出绑定相同快捷键的不同功能 */
  function findConflicts(): Map<string, string[]> {
    const byCombo = new Map<string, string[]>();
    for (const [action, combo] of Object.entries(keybinds)) {
      if (!combo) continue;
      if (!byCombo.has(combo)) byCombo.set(combo, []);
      byCombo.get(combo)!.push(action);
    }
    const conflicts = new Map<string, string[]>();
    for (const [combo, actions] of byCombo) {
      if (actions.length > 1) conflicts.set(combo, actions);
    }
    return conflicts;
  }

  if (loading) return <Loading text="加载中..." />;
  const allKeys = [...new Set([...Object.keys(DEFAULT_KEYBINDS), ...Object.keys(keybinds)])];
  const conflicts = findConflicts();

  return (
    <div className="space-y-6" onKeyDown={e => recording && handleKeyDown(e, recording)}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">快捷键绑定</h1>
          <p className="text-sm text-gray-500 mt-1">自定义键盘快捷键</p>
        </div>
        <Button variant="outline" onClick={handleReset}>恢复默认</Button>
      </div>

      {conflicts.size > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">⚠️ 冲突检测</h3>
          <div className="space-y-1">
            {[...conflicts.entries()].map(([combo, actions]) => (
              <p key={combo} className="text-sm text-amber-700 dark:text-amber-400">
                <kbd className="px-2 py-0.5 bg-amber-100 dark:bg-amber-800 rounded text-xs font-mono">{combo}</kbd>
                {' '}被多个功能绑定：{actions.join(', ')}
              </p>
            ))}
          </div>
        </div>
      )}

      <Card>
        {allKeys.length === 0 ? <EmptyState icon="keyboard" title="无快捷键配置" /> : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {allKeys.map(key => {
              const isRecording = recording === key;
              const isDefault = key in DEFAULT_KEYBINDS;
              const hasConflict = [...conflicts.values()].some(actions => actions.includes(key) && actions.length > 1);
              return (
                <div key={key} className="flex items-center gap-4 py-2.5">
                  <span className="text-sm font-mono text-gray-600 dark:text-gray-400 w-48 shrink-0">{key}</span>
                  <div className="flex-1 relative">
                    {isRecording ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border-2 border-primary-500 bg-primary-50/30 dark:bg-primary-900/10">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-sm text-primary-600 dark:text-primary-400">按下快捷键...</span>
                      </div>
                    ) : (
                      <Input
                        value={keybinds[key] || ''}
                        onChange={e => handleChange(key, e.target.value)}
                        placeholder="按键组合"
                        className="flex-1"
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant={isRecording ? 'primary' : 'ghost'}
                      icon="keyboard"
                      onClick={() => isRecording ? setRecording(null) : startRecording(key)}
                    >
                      {isRecording ? '取消' : '录制'}
                    </Button>
                    {isDefault && !(key in keybinds) && (
                      <Badge variant="default" size="sm">默认</Badge>
                    )}
                    {hasConflict && <Badge variant="warning" size="sm">冲突</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <Toast notifications={notifications} onRemove={remove} />
    </div>
  );
}
