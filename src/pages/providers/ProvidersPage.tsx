/**
 * 提供商管理页面
 * 提供商卡片列表 + 添加/编辑/删除 + 模型管理 + 连接测试
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchProviders, deleteProvider } from '../../api/providers';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Loading } from '../../components/common/Loading';
import { EmptyState } from '../../components/common/EmptyState';
import { Toast } from '../../components/common/Toast';
import { useNotification } from '../../hooks/useNotification';
import { ProviderFormModal } from './ProviderFormModal';
import { ModelManager } from './ModelManager';
import type { ProviderConfig } from '../../types/config';

/** 提供商条目（含名称） */
interface ProviderEntry {
  name: string;
  config: ProviderConfig;
}

/**
 * 提供商管理页面
 */
export function ProvidersPage() {
  const [providers, setProviders] = useState<ProviderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 弹窗状态
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProviderEntry | null>(null);

  // 模型管理状态
  const [modelManagerOpen, setModelManagerOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderEntry | null>(null);

  const { notifications, success, error: notifyError, remove } = useNotification();

  const loadProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProviders();
      const entries = Object.entries(data.providers).map(([name, config]) => ({
        name,
        config,
      }));
      setProviders(entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  /** 打开添加弹窗 */
  function handleAdd() {
    setEditingProvider(null);
    setFormModalOpen(true);
  }

  /** 打开编辑弹窗 */
  function handleEdit(entry: ProviderEntry) {
    setEditingProvider(entry);
    setFormModalOpen(true);
  }

  /** 删除提供商 */
  async function handleDelete(entry: ProviderEntry) {
    try {
      await deleteProvider(entry.name);
      success(`提供商 "${entry.name}" 已删除`);
      loadProviders();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : '删除失败');
    }
  }

  /** 打开模型管理器 */
  function handleManageModels(entry: ProviderEntry) {
    setSelectedProvider(entry);
    setModelManagerOpen(true);
  }

  /** 表单保存成功 */
  function handleFormSaved() {
    setFormModalOpen(false);
    setEditingProvider(null);
    loadProviders();
  }

  if (loading) return <Loading text="正在加载提供商..." />;

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={loadProviders}>重试</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">提供商管理</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            管理 AI 模型提供商及其模型配置
          </p>
        </div>
        <Button onClick={handleAdd} icon="add">
          添加提供商
        </Button>
      </div>

      {/* 提供商列表 */}
      {providers.length === 0 ? (
        <Card>
          <EmptyState
            icon="cloud"
            title="暂无提供商"
            description="添加你的第一个 AI 模型提供商"
            action={<Button onClick={handleAdd}>添加提供商</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {providers.map(entry => (
            <ProviderCard
              key={entry.name}
              entry={entry}
              onEdit={() => handleEdit(entry)}
              onDelete={() => handleDelete(entry)}
              onManageModels={() => handleManageModels(entry)}
            />
          ))}
        </div>
      )}

      {/* 提供商表单弹窗 */}
      {formModalOpen && (
        <ProviderFormModal
          open={formModalOpen}
          initial={editingProvider}
          onSaved={handleFormSaved}
          onClose={() => { setFormModalOpen(false); setEditingProvider(null); }}
        />
      )}

      {/* 模型管理器 */}
      {modelManagerOpen && selectedProvider && (
        <ModelManager
          open={modelManagerOpen}
          providerName={selectedProvider.name}
          onClose={() => { setModelManagerOpen(false); setSelectedProvider(null); }}
        />
      )}

      {/* 消息提示 */}
      <Toast notifications={notifications} onRemove={remove} />
    </div>
  );
}

// ============================================================
// 提供商卡片子组件（3.2.3）
// ============================================================
interface ProviderCardProps {
  entry: ProviderEntry;
  onEdit: () => void;
  onDelete: () => void;
  onManageModels: () => void;
}

function ProviderCard({ entry, onEdit, onDelete, onManageModels }: ProviderCardProps) {
  const { name, config } = entry;
  const modelCount = config.models ? Object.keys(config.models).length : 0;
  const baseURL = config.options?.baseURL || '';
  const hasApiKey = !!config.options?.apiKey;

  return (
    <Card
      hoverable
      className="relative group"
    >
      <div className="space-y-3">
        {/* 提供商名称和状态 */}
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
              {name}
            </h3>
            {config.name && (
              <p className="text-xs text-gray-400 truncate">{config.name}</p>
            )}
          </div>
        </div>

        {/* 统计信息 */}
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <span className="icon text-base leading-none">view_module</span>
            {modelCount} 个模型
          </span>
          {hasApiKey && (
            <span className="flex items-center gap-1 text-green-500">
              <span className="icon text-base leading-none">vpn_key</span>
              API Key 已配置
            </span>
          )}
        </div>

        {/* baseURL */}
        {baseURL && (
          <p className="text-xs text-gray-400 font-mono truncate" title={baseURL}>
            {baseURL}
          </p>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={onManageModels}>
            管理模型
          </Button>
          <Button size="sm" variant="ghost" icon="edit" onClick={onEdit}>
            编辑
          </Button>
          <Button size="sm" variant="ghost" icon="delete" onClick={onDelete}>
            删除
          </Button>
        </div>
      </div>
    </Card>
  );
}
