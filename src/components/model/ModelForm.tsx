/**
 * 模型配置表单组件
 * 包含模型 ID、名称、能力开关、价格和限制设置
 */

import { useState, useEffect } from 'react';
import { Input } from '../common/Input';
import { Toggle } from '../common/Toggle';
import type { ModelConfig } from '../../types/config';

interface ModelFormProps {
  /** 初始值 */
  initial?: ModelConfig;
  /** 保存回调 */
  onSave: (model: ModelConfig) => void;
  /** 取消回调 */
  onCancel: () => void;
}

/**
 * 模型编辑表单
 * @example
 * <ModelForm onSave={handleSave} onCancel={handleCancel} />
 * <ModelForm initial={existingModel} onSave={handleUpdate} onCancel={handleCancel} />
 */
export function ModelForm({ initial, onSave, onCancel }: ModelFormProps) {
  const [form, setForm] = useState<ModelConfig>({
    id: '',
    name: '',
    reasoning: false,
    attachment: false,
    tool_call: false,
    temperature: false,
    experimental: false,
    status: 'active',
    cost: { input: 0, output: 0 },
    limit: { context: 4096, output: 4096 },
  });

  useEffect(() => {
    if (initial) {
      setForm(initial);
    }
  }, [initial]);

  function updateField<K extends keyof ModelConfig>(key: K, value: ModelConfig[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    if (!form.id.trim()) return;
    onSave(form);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="模型 ID"
          value={form.id}
          onChange={e => updateField('id', e.target.value)}
          placeholder="gpt-4o"
          helpText="模型唯一标识符"
        />
        <Input
          label="显示名称"
          value={form.name || ''}
          onChange={e => updateField('name', e.target.value)}
          placeholder="GPT-4o"
          helpText="可选的友好名称"
        />
      </div>

      {/* 能力开关 */}
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">模型能力</p>
        <div className="grid grid-cols-2 gap-2">
          <Toggle checked={!!form.reasoning} onChange={v => updateField('reasoning', v)} label="推理能力" />
          <Toggle checked={!!form.attachment} onChange={v => updateField('attachment', v)} label="附件支持" />
          <Toggle checked={!!form.tool_call} onChange={v => updateField('tool_call', v)} label="工具调用" />
          <Toggle checked={!!form.temperature} onChange={v => updateField('temperature', v)} label="温度控制" />
          <Toggle checked={!!form.experimental} onChange={v => updateField('experimental', v)} label="实验性模型" />
        </div>
      </div>

      {/* 价格设置 */}
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">价格（每 1K token）</p>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="输入价格"
            type="number"
            value={form.cost?.input ?? 0}
            onChange={e => setForm(prev => ({ ...prev, cost: { ...prev.cost, input: Number(e.target.value) } }))}
            helpText="USD"
          />
          <Input
            label="输出价格"
            type="number"
            value={form.cost?.output ?? 0}
            onChange={e => setForm(prev => ({ ...prev, cost: { ...prev.cost, output: Number(e.target.value) } }))}
            helpText="USD"
          />
        </div>
      </div>

      {/* 限制设置 */}
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">限制</p>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="上下文窗口"
            type="number"
            value={form.limit?.context ?? 4096}
            onChange={e => setForm(prev => ({ ...prev, limit: { ...prev.limit, context: Number(e.target.value) } }))}
            helpText="tokens"
          />
          <Input
            label="最大输出"
            type="number"
            value={form.limit?.output ?? 4096}
            onChange={e => setForm(prev => ({ ...prev, limit: { ...prev.limit, output: Number(e.target.value) } }))}
            helpText="tokens"
          />
        </div>
      </div>

      {/* 按钮 */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!form.id.trim()}
          className="px-4 py-2 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          保存模型
        </button>
      </div>
    </div>
  );
}
