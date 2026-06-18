/**
 * 代理编辑器弹窗组件
 * 完整编辑器：基础信息 + 权限 + 工具 + 提示词
 */

import { useState, useEffect } from 'react';
import { updateAgent } from '../../api/agents';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Toggle } from '../../components/common/Toggle';
import { ColorPicker } from '../../components/common/ColorPicker';
import { MarkdownEditor } from '../../components/common/MarkdownEditor';
import { MarkdownPreview } from '../../components/common/MarkdownPreview';
import { TabGroup } from '../../components/common/TabGroup';
import type { AgentInfo } from '../../api/agents';
import type { AgentConfig } from '../../types/config';

interface AgentEditorModalProps {
  /** 是否打开 */
  open: boolean;
  /** 代理信息（编辑模式） */
  agent: AgentInfo | null;
  /** 保存成功回调 */
  onSaved: () => void;
  /** 关闭回调 */
  onClose: () => void;
}

/** 编辑标签页 */
const EDITOR_TABS = [
  { key: 'basic', label: '基础信息' },
  { key: 'prompt', label: '提示词' },
  { key: 'permissions', label: '权限' },
  { key: 'tools', label: '工具' },
];

const MODE_OPTIONS = [
  { value: 'subagent', label: '子代理 (subagent)' },
  { value: 'primary', label: '主代理 (primary)' },
  { value: 'all', label: '全部 (all)' },
];

/**
 * 代理编辑器弹窗
 */
export function AgentEditorModal({ open, agent, onSaved, onClose }: AgentEditorModalProps) {
  const isEdit = !!agent;
  const [activeTab, setActiveTab] = useState('basic');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 表单状态
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<string>('subagent');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState('0.7');
  const [color, setColor] = useState('#3b82f6');
  const [disable, setDisable] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [maxSteps, setMaxSteps] = useState('');
  const [prompt, setPrompt] = useState('');

  // 权限
  const [permissionEdit, setPermissionEdit] = useState<'ask' | 'allow' | 'deny'>('ask');
  const [permissionBash, setPermissionBash] = useState<'ask' | 'allow' | 'deny'>('ask');
  const [permissionRead, setPermissionRead] = useState<'ask' | 'allow' | 'deny'>('ask');

  useEffect(() => {
    if (agent) {
      setDescription(agent.config.description || '');
      setMode(agent.config.mode || 'subagent');
      setModel(agent.config.model || '');
      setTemperature(String(agent.config.temperature ?? 0.7));
      setColor(agent.config.color || '#3b82f6');
      setDisable(!!agent.config.disable);
      setHidden(!!agent.config.hidden);
      setMaxSteps(String(agent.config.maxSteps ?? ''));
      setPrompt(agent.fileContent || '');
      setPermissionEdit(agent.config.permission?.edit as 'ask' | 'allow' | 'deny' || 'ask');
      setPermissionBash(agent.config.permission?.bash as 'ask' | 'allow' | 'deny' || 'ask');
      setPermissionRead(agent.config.permission?.read as 'ask' | 'allow' | 'deny' || 'ask');
    } else {
      // 默认值
      setDescription('');
      setMode('subagent');
      setModel('');
      setTemperature('0.7');
      setColor('#3b82f6');
      setDisable(false);
      setHidden(false);
      setMaxSteps('');
      setPrompt('');
      setPermissionEdit('ask');
      setPermissionBash('ask');
      setPermissionRead('ask');
    }
    setError(null);
    setActiveTab('basic');
  }, [agent, open]);

  async function handleSave() {
    setSaving(true);
    setError(null);

    const config: AgentConfig = {
      ...(description ? { description } : {}),
      mode: mode as 'subagent' | 'primary' | 'all',
      ...(model ? { model } : {}),
      temperature: parseFloat(temperature) || 0.7,
      color,
      disable,
      hidden,
      ...(maxSteps ? { maxSteps: parseInt(maxSteps, 10) } : {}),
      permission: {
        edit: permissionEdit,
        bash: permissionBash,
        read: permissionRead,
      },
    };

    try {
      if (isEdit) {
        await updateAgent(agent!.name, config, prompt, { description, mode });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[85vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {isEdit ? `编辑代理 — ${agent!.name}` : '创建代理'}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <span className="icon text-xl leading-none">close</span>
          </button>
        </div>

        {/* 标签页 */}
        <TabGroup tabs={EDITOR_TABS} activeKey={activeTab} onChange={setActiveTab} className="px-4 pt-2" />

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'basic' && (
            <div className="space-y-4 max-w-2xl">
              <Input label="描述" value={description} onChange={e => setDescription(e.target.value)} placeholder="代理的功能描述" />
              <div className="grid grid-cols-2 gap-4">
                <Select label="模式" options={MODE_OPTIONS} value={mode} onChange={e => setMode(e.target.value)} />
                <Input label="模型" value={model} onChange={e => setModel(e.target.value)} placeholder="provider/model" helpText="格式: 提供商/模型名" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="温度 (temperature)" type="number" min="0" max="2" step="0.1" value={temperature} onChange={e => setTemperature(e.target.value)} />
                <Input label="最大步骤 (maxSteps)" type="number" value={maxSteps} onChange={e => setMaxSteps(e.target.value)} />
              </div>
              <ColorPicker label="主题色" value={color} onChange={setColor} />
              <div className="flex items-center gap-6">
                <Toggle checked={disable} onChange={setDisable} label="禁用代理" />
                <Toggle checked={hidden} onChange={setHidden} label="隐藏代理" />
              </div>
            </div>
          )}

          {activeTab === 'prompt' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">编辑</p>
                  <MarkdownEditor value={prompt} onChange={setPrompt} minHeight={400} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">预览</p>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3 min-h-[400px] overflow-y-auto">
                    <MarkdownPreview content={prompt || '*暂无内容*'} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="space-y-4 max-w-md">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">设置代理的默认权限策略</p>
              <Select label="读取文件 (read)" options={permissionOptions} value={permissionRead} onChange={e => setPermissionRead(e.target.value as 'ask' | 'allow' | 'deny')} />
              <Select label="编辑文件 (edit)" options={permissionOptions} value={permissionEdit} onChange={e => setPermissionEdit(e.target.value as 'ask' | 'allow' | 'deny')} />
              <Select label="执行命令 (bash)" options={permissionOptions} value={permissionBash} onChange={e => setPermissionBash(e.target.value as 'ask' | 'allow' | 'deny')} />
            </div>
          )}

          {activeTab === 'tools' && (
            <div className="py-8 text-center text-gray-400">
              <p>工具配置将在代理创建后，在工具管理页面中设置</p>
            </div>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="px-4 pb-2">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {/* 底部按钮 */}
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave} loading={saving}>
            {isEdit ? '保存修改' : '创建代理'}
          </Button>
        </div>
      </div>
    </div>
  );
}

const permissionOptions = [
  { value: 'ask', label: '每次询问 (ask)' },
  { value: 'allow', label: '允许 (allow)' },
  { value: 'deny', label: '拒绝 (deny)' },
];
