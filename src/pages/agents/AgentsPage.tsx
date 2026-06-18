/**
 * 代理管理页面
 * 主代理 + 子代理分类展示，支持创建、编辑、删除
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchAgents, createAgent, deleteAgent } from '../../api/agents';
import type { AgentInfo } from '../../api/agents';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Loading } from '../../components/common/Loading';
import { EmptyState } from '../../components/common/EmptyState';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Toast } from '../../components/common/Toast';
import { Input } from '../../components/common/Input';
import { MarkdownEditor } from '../../components/common/MarkdownEditor';
import { useNotification } from '../../hooks/useNotification';
import { AgentEditorModal } from './AgentEditorModal';

/** 代理模板 */
const AGENT_TEMPLATES = [
  {
    name: '代码审查员',
    config: { description: '审查代码质量和风格', mode: 'subagent' as const },
    prompt: '# 代码审查员\n\n你是一个专业的代码审查员，负责审查代码质量、风格和潜在问题。\n\n## 审查要点\n- 代码正确性\n- 性能问题\n- 安全漏洞\n- 代码风格\n- 可维护性',
  },
  {
    name: '文档编写员',
    config: { description: '编写技术文档和注释', mode: 'subagent' as const },
    prompt: '# 文档编写员\n\n你是一个技术文档专家，擅长编写清晰、详细的文档。\n\n## 能力\n- 编写 API 文档\n- 生成代码注释\n- 编写 README\n- 技术写作',
  },
  {
    name: '测试助手',
    config: { description: '编写和运行测试', mode: 'subagent' as const },
    prompt: '# 测试助手\n\n你是一个测试专家，擅长编写各种类型的测试。\n\n## 能力\n- 单元测试\n- 集成测试\n- E2E 测试\n- 测试覆盖率分析',
  },
];

/**
 * 代理管理页面
 */
export function AgentsPage() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [defaultAgent, setDefaultAgent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 编辑器弹窗
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentInfo | null>(null);

  // 创建模式
  const [createMode, setCreateMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState<AgentInfo | null>(null);

  const { notifications, success, error: notifyError, remove } = useNotification();

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAgents();
      setAgents(data.agents);
      setDefaultAgent(data.defaultAgent || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载代理失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const primaryAgents = agents.filter(a => a.config.mode === 'primary' || a.config.mode === 'all');
  const subAgents = agents.filter(a => a.config.mode === 'subagent' || !a.config.mode);

  /** 打开编辑弹窗 */
  function handleEdit(agent: AgentInfo) {
    setEditingAgent(agent);
    setCreateMode(false);
    setEditorOpen(true);
  }

  /** 打开创建弹窗 */
  function handleCreate() {
    setEditingAgent(null);
    setCreateMode(true);
    setNewName('');
    setNewPrompt('');
    setShowTemplates(false);
    setEditorOpen(true);
  }

  /** 从模板创建 */
  function handleTemplate(template: typeof AGENT_TEMPLATES[0]) {
    setNewName(template.name.toLowerCase().replace(/\s+/g, '-'));
    setNewPrompt(template.prompt);
    setShowTemplates(false);
  }

  /** 保存新代理 */
  async function handleCreateAgent() {
    if (!newName.trim()) {
      notifyError('请输入代理名称');
      return;
    }
    try {
      await createAgent(newName.trim(), { mode: 'subagent', description: '' }, newPrompt);
      success(`代理 "${newName}" 已创建`);
      setEditorOpen(false);
      loadAgents();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : '创建失败');
    }
  }

  /** 删除代理 */
  async function handleDelete(agent: AgentInfo) {
    try {
      await deleteAgent(agent.name);
      success(`代理 "${agent.name}" 已删除`);
      loadAgents();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : '删除失败');
    }
    setDeleteTarget(null);
  }

  /** 编辑器保存成功 */
  function handleEditorSaved() {
    setEditorOpen(false);
    setEditingAgent(null);
    success(createMode ? '代理已创建' : '代理已更新');
    loadAgents();
  }

  if (loading) return <Loading text="正在加载代理..." />;

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={loadAgents}>重试</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">代理管理</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            管理 AI 代理及其配置
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowTemplates(!showTemplates)} icon="auto_awesome">
            从模板创建
          </Button>
          <Button onClick={handleCreate} icon="add">创建代理</Button>
        </div>
      </div>

      {/* 模板选择 */}
      {showTemplates && (
        <Card title="选择模板">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {AGENT_TEMPLATES.map(template => (
              <button
                key={template.name}
                type="button"
                onClick={() => handleTemplate(template)}
                className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-left transition-colors"
              >
                <h4 className="font-medium text-gray-900 dark:text-gray-100">{template.name}</h4>
                <p className="text-xs text-gray-500 mt-1">{template.config.description}</p>
                <span className="text-xs text-primary-600 mt-2 block">点击使用此模板</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* 默认代理 */}
      {defaultAgent && (
        <Card title={`默认代理`}>
          {(() => {
            const da = agents.find(a => a.name === defaultAgent);
            return da ? (
              <div className="flex items-center justify-between p-3 rounded-md bg-primary-50/50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-800">
                <div className="flex items-center gap-3">
                  <span className="icon text-primary-500 text-2xl">star</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{da.name}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{da.config.description || '默认入口代理'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="primary" size="sm">默认</Badge>
                  <Button size="sm" variant="ghost" icon="edit" onClick={() => handleEdit(da)}>编辑</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">默认代理 "{defaultAgent}" 的配置文件不存在</p>
            );
          })()}
        </Card>
      )}

      {/* 主代理 */}
      <Card title={`主代理 (${primaryAgents.length})`}>
        {primaryAgents.length === 0 ? (
          <EmptyState icon="smart_toy" title="暂无主代理" description="主代理是入口代理，可调用子代理" />
        ) : (
          <AgentList agents={primaryAgents} onEdit={handleEdit} onDelete={setDeleteTarget} defaultAgent={defaultAgent} />
        )}
      </Card>

      {/* 子代理 */}
      <Card title={`子代理 (${subAgents.length})`}>
        {subAgents.length === 0 ? (
          <EmptyState icon="smart_toy" title="暂无子代理" description="子代理可被主代理调用来完成特定任务" />
        ) : (
          <AgentList agents={subAgents} onEdit={handleEdit} onDelete={setDeleteTarget} defaultAgent={defaultAgent} />
        )}
      </Card>

      {/* 创建代理弹窗 */}
      {editorOpen && createMode && !editingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditorOpen(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">创建新代理</h3>
            <div className="space-y-4">
              <Input label="代理名称" value={newName} onChange={e => setNewName(e.target.value)} placeholder="my-agent" helpText="小写字母、数字、连字符，2-32 字符" />
              <MarkdownEditor label="提示词" value={newPrompt} onChange={setNewPrompt} minHeight={200} placeholder="输入代理的系统提示词..." />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setEditorOpen(false)}>取消</Button>
              <Button onClick={handleCreateAgent}>创建代理</Button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑代理弹窗 */}
      {editorOpen && editingAgent && (
        <AgentEditorModal
          open={editorOpen}
          agent={editingAgent}
          onSaved={handleEditorSaved}
          onClose={() => { setEditorOpen(false); setEditingAgent(null); }}
        />
      )}

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="确认删除代理"
        message={`确定要删除代理 "${deleteTarget?.name}" 吗？此操作将同时删除配置文件引用和 .md 文件，不可撤销。`}
        confirmText="删除"
        confirmVariant="danger"
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />

      <Toast notifications={notifications} onRemove={remove} />
    </div>
  );
}

// ============================================================
// 代理列表子组件
// ============================================================
interface AgentListProps {
  agents: AgentInfo[];
  onEdit: (agent: AgentInfo) => void;
  onDelete: (agent: AgentInfo) => void;
  defaultAgent?: string | null;
}

function AgentList({ agents, onEdit, onDelete, defaultAgent }: AgentListProps) {
  return (
    <div className="space-y-2">
      {agents.map(agent => {
        const isDefault = agent.name === defaultAgent;
        return (
          <div
            key={agent.name}
            className={`flex items-center justify-between p-3 rounded-md transition-colors ${
              isDefault
                ? 'bg-primary-50/30 dark:bg-primary-900/5 border border-primary-200/50 dark:border-primary-800/30'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{agent.name}</span>
                {isDefault && <Badge variant="primary" size="sm">默认</Badge>}
                <Badge variant={agent.config.mode === 'primary' || agent.config.mode === 'all' ? 'primary' : 'default'} size="sm">
                  {agent.config.mode || 'subagent'}
                </Badge>
                {agent.config.disable && <Badge variant="warning" size="sm">已禁用</Badge>}
              </div>
              {agent.config.description && (
                <p className="text-xs text-gray-500 mt-0.5 truncate">{agent.config.description}</p>
              )}
              {agent.config.model && (
                <p className="text-xs text-gray-400 font-mono mt-0.5">{agent.config.model}</p>
              )}
            </div>
            <div className="flex items-center gap-1 ml-4">
              <Button size="sm" variant="ghost" icon="edit" onClick={() => onEdit(agent)}>编辑</Button>
              <Button size="sm" variant="ghost" icon="delete" onClick={() => onDelete(agent)}>删除</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
