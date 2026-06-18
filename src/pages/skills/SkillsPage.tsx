/**
 * 技能管理页面
 * 技能列表 + 启用/禁用切换 + 创建/编辑/删除
 */

import { useState, useEffect, useCallback } from 'react';
import {
  fetchSkills,
  createSkill,
  deleteSkill,
  setSkillPermission,
  rescanSkills,
} from '../../api/skills';
import type { SkillInfo } from '../../api/skills';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Loading } from '../../components/common/Loading';
import { EmptyState } from '../../components/common/EmptyState';
import { Toggle } from '../../components/common/Toggle';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { MarkdownEditor } from '../../components/common/MarkdownEditor';
import { Input } from '../../components/common/Input';
import { Toast } from '../../components/common/Toast';
import { useNotification } from '../../hooks/useNotification';
import { SkillEditorModal } from './SkillEditorModal';

/**
 * 技能管理页面
 */
export function SkillsPage() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [permissions, setPermissions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 编辑器弹窗
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillInfo | null>(null);

  // 创建模式
  const [createMode, setCreateMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newContent, setNewContent] = useState('');

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState<SkillInfo | null>(null);

  const { notifications, success, error: notifyError, remove } = useNotification();

  const loadSkills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSkills();
      setSkills(data.skills);
      setPermissions(data.permissions);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载技能失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  /** 切换技能启用状态 */
  async function handleToggle(skill: SkillInfo) {
    const newPermission = permissions[skill.name] === 'allow' ? 'deny' : 'allow';
    try {
      await setSkillPermission(skill.name, newPermission);
      setPermissions(prev => ({ ...prev, [skill.name]: newPermission }));
      success(`${skill.name} 已${newPermission === 'allow' ? '启用' : '禁用'}`);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : '操作失败');
    }
  }

  /** 打开编辑弹窗 */
  function handleEdit(skill: SkillInfo) {
    setEditingSkill(skill);
    setCreateMode(false);
    setEditorOpen(true);
  }

  /** 创建技能 */
  async function handleCreate() {
    if (!newName.trim()) {
      notifyError('请输入技能名称');
      return;
    }
    try {
      await createSkill({
        name: newName.trim(),
        description: newDescription,
        content: newContent,
      });
      success(`技能 "${newName}" 已创建`);
      setCreateMode(false);
      setNewName('');
      setNewDescription('');
      setNewContent('');
      loadSkills();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : '创建失败');
    }
  }

  /** 删除技能 */
  async function handleDelete(skill: SkillInfo) {
    try {
      await deleteSkill(skill.name);
      success(`技能 "${skill.name}" 已删除`);
      loadSkills();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : '删除失败');
    }
    setDeleteTarget(null);
  }

  /** 编辑器保存成功 */
  function handleEditorSaved() {
    setEditorOpen(false);
    setEditingSkill(null);
    success('技能已更新');
    loadSkills();
  }

  /** 重新扫描 */
  async function handleRescan() {
    try {
      const data = await rescanSkills();
      setSkills(data.skills);
      setPermissions(data.permissions);
      success('技能目录已重新扫描');
    } catch (err) {
      notifyError(err instanceof Error ? err.message : '扫描失败');
    }
  }

  if (loading) return <Loading text="正在加载技能..." />;

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={loadSkills}>重试</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">技能管理</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            管理 AI 技能及其权限
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRescan} icon="refresh">
            重新扫描
          </Button>
          <Button onClick={() => setCreateMode(true)} icon="add">
            创建技能
          </Button>
        </div>
      </div>

      {/* 技能列表 */}
      {skills.length === 0 && !createMode ? (
        <Card>
          <EmptyState
            icon="psychology"
            title="暂无技能"
            description="技能存储在 ~/.config/opencode/skills/ 目录下，点击创建或重新扫描"
            action={
              <div className="flex gap-2">
                <Button onClick={() => setCreateMode(true)}>创建技能</Button>
                <Button variant="outline" onClick={handleRescan}>重新扫描</Button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {skills.map(skill => {
            const isEnabled = permissions[skill.name] !== 'deny';
            return (
              <Card key={skill.name} hoverable>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {skill.name}
                      </h3>
                      {skill.severity === 'mandatory' && (
                        <Badge variant="danger" size="sm">强制</Badge>
                      )}
                      {skill.persistence === 'infinite' && (
                        <Badge variant="info" size="sm">永久</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                      {skill.description || '无描述'}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      {skill.license && <span>许可证: {skill.license}</span>}
                      {skill.compatibility && <span>兼容: {skill.compatibility}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Toggle
                      checked={isEnabled}
                      onChange={() => handleToggle(skill)}
                      label={isEnabled ? '已启用' : '已禁用'}
                    />
                    <Button size="sm" variant="ghost" icon="edit" onClick={() => handleEdit(skill)}>
                      编辑
                    </Button>
                    <Button size="sm" variant="ghost" icon="delete" onClick={() => setDeleteTarget(skill)}>
                      删除
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 创建技能弹窗 */}
      {createMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setCreateMode(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">创建技能</h3>
            <div className="space-y-4">
              <Input
                label="技能名称"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="my-skill"
                helpText="将创建目录 skills/my-skill/SKILL.md"
              />
              <Input
                label="描述"
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                placeholder="技能描述"
              />
              <MarkdownEditor
                label="技能内容"
                value={newContent}
                onChange={setNewContent}
                minHeight={200}
                placeholder="输入技能的 Markdown 内容..."
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setCreateMode(false)}>取消</Button>
              <Button onClick={handleCreate}>创建技能</Button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑弹窗 */}
      {editorOpen && editingSkill && (
        <SkillEditorModal
          open={editorOpen}
          skill={editingSkill}
          onSaved={handleEditorSaved}
          onClose={() => { setEditorOpen(false); setEditingSkill(null); }}
        />
      )}

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="确认删除技能"
        message={`确定要删除技能 "${deleteTarget?.name}" 吗？此操作将删除 skills/${deleteTarget?.name}/ 整个目录，不可撤销。`}
        confirmText="删除"
        confirmVariant="danger"
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />

      <Toast notifications={notifications} onRemove={remove} />
    </div>
  );
}
