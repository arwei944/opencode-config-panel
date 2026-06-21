import { useState, useEffect, useCallback } from 'react';
import { get, put } from '../../api/client';
import { CodeEditor } from '../../components/common/CodeEditor';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Loading } from '../../components/common/Loading';
import { TabGroup } from '../../components/common/TabGroup';
import { Toast } from '../../components/common/Toast';
import { useNotification } from '../../hooks/useNotification';

type EditorMode = 'edit' | 'diff';

export function RawEditorPage() {
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<EditorMode>('edit');
  const { notifications, success, error: notifyError, remove } = useNotification();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await get<{ config: Record<string, unknown> }>('/config');
      const json = JSON.stringify(d.config, null, 2);
      setContent(json);
      setSavedContent(json);
    } catch { notifyError('加载失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      const parsed = JSON.parse(content);
      await put('/config', parsed);
      setSavedContent(content);
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

  function handleMinify() {
    try { setContent(JSON.stringify(JSON.parse(content))); }
    catch { setError('无法压缩：JSON 格式错误'); }
  }

  /** 验证 JSON 并返回错误位置 */
  function validateJSON(text: string): string | null {
    try { JSON.parse(text); return null; }
    catch (e) { return (e as SyntaxError).message; }
  }

  if (loading) return <Loading text="加载中..." />;

  const validationError = validateJSON(content);
  const hasChanges = content !== savedContent;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">JSON 编辑器</h1>
          <p className="text-sm text-gray-500 mt-1">直接编辑 opencode.json 原始内容</p>
        </div>
        <div className="flex items-center gap-2">
          <TabGroup
            tabs={[
              { key: 'edit', label: '编辑' },
              { key: 'diff', label: '对比' },
            ]}
            activeKey={mode}
            onChange={t => setMode(t as EditorMode)}
          />
          <Button variant="outline" onClick={handleFormat} icon="format_align_left">格式化</Button>
          <Button variant="outline" onClick={handleMinify} icon="compress">压缩</Button>
          <Button onClick={handleSave} loading={saving} icon="save" disabled={!!validationError || !hasChanges}>
            {hasChanges ? '保存' : '已保存'}
          </Button>
        </div>
      </div>

      {/* 状态栏 */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>{content.split('\n').length} 行</span>
        <span>{content.length} 字符</span>
        {validationError ? (
          <span className="text-red-500 font-medium">⚠️ JSON 错误: {validationError}</span>
        ) : (
          <span className="text-green-600">✅ JSON 有效</span>
        )}
        {hasChanges && !validationError && (
          <span className="text-amber-600">📝 有未保存的更改</span>
        )}
      </div>

      {error && !validationError && <p className="text-sm text-red-500">{error}</p>}

      <Card padding="none">
        {mode === 'diff' && savedContent ? (
          <div className="p-4">
            <pre className="text-xs font-mono overflow-auto max-h-[600px]">
              <DiffDisplay oldText={savedContent} newText={content} />
            </pre>
          </div>
        ) : (
          <CodeEditor value={content} onChange={setContent} language="json" minHeight={500} />
        )}
      </Card>

      <Toast notifications={notifications} onRemove={remove} />
    </div>
  );
}

/** 简易行级 diff 显示 */
function DiffDisplay({ oldText, newText }: { oldText: string; newText: string }) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const maxLen = Math.max(oldLines.length, newLines.length);

  return (
    <table className="w-full border-collapse">
      <tbody>
        {Array.from({ length: maxLen }, (_, i) => {
          const oldLine = i < oldLines.length ? oldLines[i] : undefined;
          const newLine = i < newLines.length ? newLines[i] : undefined;
          const changed = oldLine !== newLine;

          if (oldLine === undefined) {
            // 新增行
            return (
              <tr key={i} className="bg-green-50 dark:bg-green-900/10">
                <td className="text-right text-gray-400 pr-3 select-none w-8">{i + 1}</td>
                <td className="text-right text-gray-400 pr-3 select-none w-8"></td>
                <td className="text-green-700 dark:text-green-400"><span className="text-green-500 mr-2">+</span>{newLine}</td>
              </tr>
            );
          }
          if (newLine === undefined) {
            // 删除行
            return (
              <tr key={i} className="bg-red-50 dark:bg-red-900/10">
                <td className="text-right text-gray-400 pr-3 select-none w-8">{i + 1}</td>
                <td className="text-right text-gray-400 pr-3 select-none w-8"></td>
                <td className="text-red-700 dark:text-red-400"><span className="text-red-500 mr-2">-</span>{oldLine}</td>
              </tr>
            );
          }
          return (
            <tr key={i} className={changed ? 'bg-yellow-50 dark:bg-yellow-900/5' : ''}>
              <td className="text-right text-gray-400 pr-3 select-none w-8">{i + 1}</td>
              <td className="text-right text-gray-400 pr-3 select-none w-8">{i + 1}</td>
              <td className={changed ? 'text-yellow-700 dark:text-yellow-400' : ''}>
                {changed && <span className="text-yellow-500 mr-2">~</span>}
                {newLine}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
