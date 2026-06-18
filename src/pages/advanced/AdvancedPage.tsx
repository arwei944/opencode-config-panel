import { useState, useEffect, useCallback } from 'react';
import { get, patch } from '../../api/client';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Toggle } from '../../components/common/Toggle';
import { TabGroup } from '../../components/common/TabGroup';
import { Loading } from '../../components/common/Loading';
import { JsonPreview } from '../../components/common/JsonPreview';
import { Toast } from '../../components/common/Toast';
import { useNotification } from '../../hooks/useNotification';

const TABS = [
  { key: 'server', label: '服务器' },
  { key: 'compaction', label: '压缩' },
  { key: 'attachment', label: '附件' },
  { key: 'tool_output', label: '工具输出' },
  { key: 'experimental', label: '实验性' },
];

export function AdvancedPage() {
  const [activeTab, setActiveTab] = useState('server');
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const { notifications, success, error: notifyError, remove } = useNotification();

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await get<{ config: Record<string, unknown> }>('/config'); setConfig(d.config); }
    catch { notifyError('加载失败'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(section: string, data: unknown) {
    try { await patch('/config', { [section]: data }); success(`${section} 已更新`); load(); }
    catch (e) { notifyError((e as Error).message); }
  }

  if (loading) return <Loading text="加载中..." />;

  const server = (config.server || {}) as Record<string, unknown>;
  const compaction = (config.compaction || {}) as Record<string, unknown>;
  const attachment = (config.attachment || {}) as Record<string, unknown>;
  const tool_output = (config.tool_output || {}) as Record<string, unknown>;
  const experimental = (config.experimental || {}) as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">高级设置</h1>
      <TabGroup tabs={TABS} activeKey={activeTab} onChange={setActiveTab} />

      {activeTab === 'server' && (
        <Card title="服务器配置">
          <div className="space-y-3 max-w-md">
            <Input label="端口" type="number" value={String(server.port || 3456)} onChange={e => handleSave('server', { ...server, port: parseInt(e.target.value) || 3456 })} />
            <Input label="主机地址" value={(server.hostname as string) || '127.0.0.1'} onChange={e => handleSave('server', { ...server, hostname: e.target.value })} />
            <Toggle checked={!!server.mdns} onChange={v => handleSave('server', { ...server, mdns: v })} label="启用 mDNS" />
          </div>
        </Card>
      )}

      {activeTab === 'compaction' && (
        <Card title="压缩配置">
          <div className="space-y-3 max-w-md">
            <Toggle checked={!!compaction.auto} onChange={v => handleSave('compaction', { ...compaction, auto: v })} label="自动压缩" />
            <Toggle checked={!!compaction.prune} onChange={v => handleSave('compaction', { ...compaction, prune: v })} label="修剪消息" />
            <Input label="保留轮次" type="number" value={String(compaction.tail_turns || '')} onChange={e => handleSave('compaction', { ...compaction, tail_turns: parseInt(e.target.value) || undefined })} />
          </div>
        </Card>
      )}

      {activeTab === 'attachment' && (
        <Card title="附件配置">
          <div className="space-y-3 max-w-md">
            <Toggle checked={!!((attachment as Record<string, unknown>)?.image as Record<string, unknown>)?.auto_resize} onChange={v => handleSave('attachment', { image: { ...((attachment as Record<string, unknown>)?.image as Record<string, unknown> || {}), auto_resize: v } })} label="自动调整图片大小" />
            <Input label="最大宽度" type="number" value={String(((attachment as Record<string, unknown>)?.image as Record<string, unknown>)?.max_width || '')} onChange={e => handleSave('attachment', { image: { ...((attachment as Record<string, unknown>)?.image as Record<string, unknown> || {}), max_width: parseInt(e.target.value) || undefined } })} />
          </div>
        </Card>
      )}

      {activeTab === 'tool_output' && (
        <Card title="工具输出限制">
          <div className="space-y-3 max-w-md">
            <Input label="最大行数" type="number" value={String(tool_output.max_lines || '')} onChange={e => handleSave('tool_output', { ...tool_output, max_lines: parseInt(e.target.value) || undefined })} />
            <Input label="最大字节数" type="number" value={String(tool_output.max_bytes || '')} onChange={e => handleSave('tool_output', { ...tool_output, max_bytes: parseInt(e.target.value) || undefined })} />
          </div>
        </Card>
      )}

      {activeTab === 'experimental' && (
        <Card title="实验性开关">
          <div className="space-y-3 max-w-md">
            <Toggle checked={!!experimental.batch_tool} onChange={v => handleSave('experimental', { ...experimental, batch_tool: v })} label="批量工具调用" />
            <Toggle checked={!!experimental.openTelemetry} onChange={v => handleSave('experimental', { ...experimental, openTelemetry: v })} label="OpenTelemetry" />
            <Toggle checked={!!experimental.continue_loop_on_deny} onChange={v => handleSave('experimental', { ...experimental, continue_loop_on_deny: v })} label="拒绝后继续循环" />
            <Toggle checked={!!experimental.disable_paste_summary} onChange={v => handleSave('experimental', { ...experimental, disable_paste_summary: v })} label="禁用粘贴摘要" />
            <Input label="聊天最大重试" type="number" value={String(experimental.chatMaxRetries || '')} onChange={e => handleSave('experimental', { ...experimental, chatMaxRetries: parseInt(e.target.value) || undefined })} />
            <Input label="MCP 超时 (ms)" type="number" value={String(experimental.mcp_timeout || '')} onChange={e => handleSave('experimental', { ...experimental, mcp_timeout: parseInt(e.target.value) || undefined })} />
          </div>
        </Card>
      )}

      <Card title="完整配置预览">
        <JsonPreview data={config} />
      </Card>
      <Toast notifications={notifications} onRemove={remove} />
    </div>
  );
}
