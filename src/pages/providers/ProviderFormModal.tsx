/**
 * 提供商表单弹窗组件
 * 添加/编辑提供商，支持名称、npm 包、API 地址、API Key 配置
 * 包含 API Key 脱敏显示功能（3.2.8）
 */

import { useState, useEffect } from 'react';
import { createProvider, updateProvider } from '../../api/providers';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { KeyValueEditor } from '../../components/common/KeyValueEditor';
import type { ProviderConfig } from '../../types/config';

interface ProviderFormModalProps {
  /** 是否打开 */
  open: boolean;
  /** 编辑模式时传入现有提供商 */
  initial: { name: string; config: ProviderConfig } | null;
  /** 保存成功回调 */
  onSaved: () => void;
  /** 关闭回调 */
  onClose: () => void;
}

/**
 * 提供商表单弹窗
 */
export function ProviderFormModal({ open, initial, onSaved, onClose }: ProviderFormModalProps) {
  const isEdit = !!initial;

  const [name, setName] = useState('');
  const [npm, setNpm] = useState('');
  const [baseURL, setBaseURL] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [env, setEnv] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setNpm(initial.config.npm || '');
      setBaseURL(initial.config.options?.baseURL || '');
      setApiKey(initial.config.options?.apiKey || '');
      setEnv(initial.config.env?.reduce((acc, e) => ({ ...acc, [e]: '' }), {}) || {});
    } else {
      setName('');
      setNpm('');
      setBaseURL('');
      setApiKey('');
      setShowApiKey(false);
      setEnv({});
    }
    setError(null);
  }, [initial, open]);

  async function handleSave() {
    if (!name.trim()) {
      setError('提供商名称不能为空');
      return;
    }

    setSaving(true);
    setError(null);

    const config: ProviderConfig = {
      npm: npm || undefined,
      options: {
        ...(baseURL ? { baseURL } : {}),
        ...(apiKey ? { apiKey } : {}),
      },
      env: Object.keys(env).length > 0 ? Object.keys(env) : undefined,
    };

    try {
      if (isEdit) {
        await updateProvider(initial!.name, config);
      } else {
        await createProvider(name.trim(), config);
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
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {isEdit ? '编辑提供商' : '添加提供商'}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <span className="icon text-xl leading-none">close</span>
          </button>
        </div>

        <div className="space-y-4">
          {/* 名称 */}
          <Input
            label="提供商名称"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="my-provider"
            disabled={isEdit}
            helpText={isEdit ? '创建后名称不可修改' : '小写字母、数字、连字符，2-32 字符'}
            error={error || undefined}
          />

          {/* npm 包名 */}
          <Input
            label="npm 包名"
            value={npm}
            onChange={e => setNpm(e.target.value)}
            placeholder="@ai-sdk/openai-compatible"
            helpText="AI SDK 提供商的 npm 包名称（可选）"
          />

          {/* API 地址 */}
          <Input
            label="API 地址"
            value={baseURL}
            onChange={e => setBaseURL(e.target.value)}
            placeholder="https://api.example.com/v1"
            helpText="必须以 https:// 或 http:// 开头"
          />

          {/* API Key（脱敏显示） */}
          <div>
            <Input
              label="API Key"
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-..."
              helpText="API Key 仅保存在本地配置中"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="mt-1 text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <span className="icon text-base leading-none">{showApiKey ? 'visibility_off' : 'visibility'}</span>
              {showApiKey ? '隐藏' : '显示'} API Key
            </button>
          </div>

          {/* 环境变量 */}
          <KeyValueEditor
            label="环境变量"
            value={env}
            onChange={setEnv}
            keyPlaceholder="变量名"
            valuePlaceholder="值"
          />
        </div>

        {/* 错误提示 */}
        {error && (
          <p className="mt-3 text-sm text-red-500">{error}</p>
        )}

        {/* 按钮 */}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {isEdit ? '保存修改' : '创建提供商'}
          </Button>
        </div>
      </div>
    </div>
  );
}
