/**
 * 模型管理器组件
 * 模型列表 + 添加/编辑/删除 + 连接测试
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchModels, createModel, deleteModel, testProviderConnection } from '../../api/providers';
import { ModelList } from '../../components/model/ModelList';
import { ModelForm } from '../../components/model/ModelForm';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { EmptyState } from '../../components/common/EmptyState';
import type { ModelConfig } from '../../types/config';

interface ModelManagerProps {
  /** 是否打开 */
  open: boolean;
  /** 提供商名称 */
  providerName: string;
  /** 关闭回调 */
  onClose: () => void;
}

/**
 * 模型管理器弹窗
 * 包含模型列表、添加/编辑表单和连接测试功能
 */
export function ModelManager({ open, providerName, onClose }: ModelManagerProps) {
  const [models, setModels] = useState<Record<string, ModelConfig>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 添加/编辑状态
  const [showForm, setShowForm] = useState(false);
  const [editingModel, setEditingModel] = useState<{ key: string; config: ModelConfig } | null>(null);

  // 连接测试状态
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    reachable: boolean;
    latencyMs: number;
    modelsFetched: number;
    error: string | null;
  } | null>(null);

  const loadModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchModels(providerName);
      setModels(data.models || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载模型失败');
    } finally {
      setLoading(false);
    }
  }, [providerName]);

  useEffect(() => {
    if (open) loadModels();
  }, [open, loadModels]);

  /** 连接测试 */
  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testProviderConnection(providerName);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        reachable: false,
        latencyMs: 0,
        modelsFetched: 0,
        error: err instanceof Error ? err.message : '测试失败',
      });
    } finally {
      setTesting(false);
    }
  }

  /** 添加模型 */
  function handleAddModel() {
    setEditingModel(null);
    setShowForm(true);
  }

  /** 编辑模型 */
  function handleEditModel(key: string, config: ModelConfig) {
    setEditingModel({ key, config });
    setShowForm(true);
  }

  /** 删除模型 */
  async function handleDeleteModel(key: string) {
    try {
      await deleteModel(providerName, key);
      loadModels();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  }

  /** 保存模型 */
  async function handleSaveModel(modelConfig: ModelConfig) {
    try {
      if (editingModel) {
        // 编辑模式：先删后加
        await deleteModel(providerName, editingModel.key);
      }
      const modelKey = modelConfig.id;
      await createModel(providerName, modelKey, modelConfig);
      setShowForm(false);
      setEditingModel(null);
      loadModels();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[85vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              模型管理 — {providerName}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {Object.keys(models).length} 个模型
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* 连接测试按钮（3.2.7） */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleTestConnection}
              loading={testing}
              icon={testResult?.reachable ? 'check_circle' : 'wifi'}
            >
              测试连接
            </Button>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <span className="icon text-xl leading-none">close</span>
            </button>
          </div>
        </div>

        {/* 连接测试结果 */}
        {testResult && (
          <div className={`mx-4 mt-3 p-3 rounded-md text-sm ${
            testResult.reachable
              ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
          }`}>
            <div className="flex items-center gap-2">
              <span className="icon text-lg leading-none">
                {testResult.reachable ? 'check_circle' : 'error'}
              </span>
              <span>
                {testResult.reachable
                  ? `连接成功 — 延迟 ${testResult.latencyMs}ms，获取到 ${testResult.modelsFetched} 个模型`
                  : `连接失败: ${testResult.error}`}
              </span>
            </div>
          </div>
        )}

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-4">
          {showForm ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {editingModel ? '编辑模型' : '添加模型'}
                </h4>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingModel(null); }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  返回列表
                </button>
              </div>
              <ModelForm
                initial={editingModel?.config}
                onSave={handleSaveModel}
                onCancel={() => { setShowForm(false); setEditingModel(null); }}
              />
            </div>
          ) : loading ? (
            <Loading text="加载模型中..." />
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">模型列表</h4>
                <Button size="sm" onClick={handleAddModel} icon="add">添加模型</Button>
              </div>
              {Object.keys(models).length === 0 ? (
                <EmptyState
                  icon="view_module"
                  title="暂无模型"
                  description="点击添加模型按钮创建第一个模型"
                  action={<Button size="sm" onClick={handleAddModel}>添加模型</Button>}
                />
              ) : (
                <ModelList
                  models={models}
                  onSelect={(key, config) => handleEditModel(key, config)}
                  onDelete={handleDeleteModel}
                />
              )}
            </div>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="px-4 pb-3">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
