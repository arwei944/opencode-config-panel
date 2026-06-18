import { useState, useEffect } from 'react';
import { createMcpServer, updateMcpServer } from '../../api/mcp';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Toggle } from '../../components/common/Toggle';
import { KeyValueEditor } from '../../components/common/KeyValueEditor';

interface McpEditorModalProps {
  open: boolean;
  initial: { name: string; config: Record<string, unknown> } | null;
  onSaved: () => void;
  onClose: () => void;
}

const TYPE_OPTIONS = [
  { value: 'local', label: '本地 (local)' },
  { value: 'remote', label: '远程 (remote)' },
];

export function McpEditorModal({ open, initial, onSaved, onClose }: McpEditorModalProps) {
  const isEdit = !!initial;
  const [name, setName] = useState('');
  const [type, setType] = useState('local');
  const [command, setCommand] = useState('');
  const [url, setUrl] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [timeout, setTimeout_] = useState('5000');
  const [environment, setEnvironment] = useState<Record<string, string>>({});
  const [headers, setHeaders] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      const c = initial.config;
      setType((c.type as string) || 'local');
      setCommand(Array.isArray(c.command) ? (c.command as string[]).join(' ') : '');
      setUrl((c.url as string) || '');
      setEnabled(c.enabled !== false);
      setTimeout_(String(c.timeout || 5000));
      setEnvironment((c.environment as Record<string, string>) || {});
      setHeaders((c.headers as Record<string, string>) || {});
    } else {
      setName(''); setType('local'); setCommand(''); setUrl(''); setEnabled(true);
      setTimeout_('5000'); setEnvironment({}); setHeaders({});
    }
    setError(null);
  }, [initial, open]);

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      const config: Record<string, unknown> = { enabled };
      if (type === 'local') {
        config.type = 'local';
        config.command = command.split(' ').filter(Boolean);
        config.timeout = parseInt(timeout, 10) || 5000;
        if (Object.keys(environment).length > 0) config.environment = environment;
      } else {
        config.type = 'remote';
        config.url = url;
        if (Object.keys(headers).length > 0) config.headers = headers;
      }
      if (isEdit) await updateMcpServer(initial!.name, config);
      else await createMcpServer(name.trim(), config);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally { setSaving(false); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{isEdit ? '编辑 MCP 服务器' : '添加 MCP 服务器'}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <span className="icon text-xl leading-none">close</span>
          </button>
        </div>
        <div className="space-y-4">
          <Input label="名称" value={name} onChange={e => setName(e.target.value)} disabled={isEdit} placeholder="my-mcp-server" />
          <Select label="类型" options={TYPE_OPTIONS} value={type} onChange={e => setType(e.target.value)} disabled={isEdit} />
          {type === 'local' ? (
            <>
              <Input label="命令" value={command} onChange={e => setCommand(e.target.value)} placeholder="npx -y @modelcontextprotocol/server-filesystem /path" />
              <Input label="超时 (ms)" type="number" value={timeout} onChange={e => setTimeout_(e.target.value)} />
              <KeyValueEditor label="环境变量" value={environment} onChange={setEnvironment} />
            </>
          ) : (
            <>
              <Input label="URL" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://api.example.com/mcp" />
              <KeyValueEditor label="请求头" value={headers} onChange={setHeaders} keyPlaceholder="Header" valuePlaceholder="Value" />
            </>
          )}
          <Toggle checked={enabled} onChange={setEnabled} label="启用" />
        </div>
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave} loading={saving}>{isEdit ? '保存' : '创建'}</Button>
        </div>
      </div>
    </div>
  );
}
