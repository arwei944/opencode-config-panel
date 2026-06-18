/**
 * 技能编辑器弹窗组件
 * YAML front-matter 编辑 + Markdown 内容编辑
 */

import { useState, useEffect } from 'react';
import { updateSkill } from '../../api/skills';
import type { SkillInfo } from '../../api/skills';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { MarkdownEditor } from '../../components/common/MarkdownEditor';
import { MarkdownPreview } from '../../components/common/MarkdownPreview';
import { TabGroup } from '../../components/common/TabGroup';

interface SkillEditorModalProps {
  /** 是否打开 */
  open: boolean;
  /** 技能信息 */
  skill: SkillInfo;
  /** 保存成功回调 */
  onSaved: () => void;
  /** 关闭回调 */
  onClose: () => void;
}

const SEVERITY_OPTIONS = [
  { value: 'mandatory', label: '强制 (mandatory)' },
  { value: 'optional', label: '可选 (optional)' },
];

const PERSISTENCE_OPTIONS = [
  { value: 'session', label: '会话 (session)' },
  { value: 'infinite', label: '永久 (infinite)' },
];

const EDITOR_TABS = [
  { key: 'content', label: '内容' },
  { key: 'preview', label: '预览' },
];

/**
 * 技能编辑器弹窗
 */
export function SkillEditorModal({ open, skill, onSaved, onClose }: SkillEditorModalProps) {
  const [activeTab, setActiveTab] = useState('content');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 表单状态
  const [description, setDescription] = useState('');
  const [license, setLicense] = useState('');
  const [compatibility, setCompatibility] = useState('');
  const [severity, setSeverity] = useState('optional');
  const [persistence, setPersistence] = useState('session');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (skill) {
      setDescription(skill.description || '');
      setLicense(skill.license || '');
      setCompatibility(skill.compatibility || '');
      setSeverity(skill.severity || 'optional');
      setPersistence(skill.persistence || 'session');
      setContent(skill.content || '');
    }
    setError(null);
  }, [skill, open]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateSkill(skill.name, {
        description,
        license: license || undefined,
        compatibility: compatibility || undefined,
        severity: severity as 'mandatory' | 'optional',
        persistence: persistence as 'session' | 'infinite',
        content,
      });
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
            编辑技能 — {skill.name}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <span className="icon text-xl leading-none">close</span>
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 元信息 */}
          <div className="grid grid-cols-2 gap-4">
            <Input label="描述" value={description} onChange={e => setDescription(e.target.value)} placeholder="技能描述" />
            <Input label="许可证" value={license} onChange={e => setLicense(e.target.value)} placeholder="MIT" />
            <Input label="兼容性" value={compatibility} onChange={e => setCompatibility(e.target.value)} placeholder="opencode" />
            <div className="grid grid-cols-2 gap-3">
              <Select label="严重级别" options={SEVERITY_OPTIONS} value={severity} onChange={e => setSeverity(e.target.value)} />
              <Select label="持久性" options={PERSISTENCE_OPTIONS} value={persistence} onChange={e => setPersistence(e.target.value)} />
            </div>
          </div>

          {/* 内容编辑 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">技能内容</label>
              <TabGroup tabs={EDITOR_TABS} activeKey={activeTab} onChange={setActiveTab} />
            </div>
            {activeTab === 'content' ? (
              <MarkdownEditor value={content} onChange={setContent} minHeight={300} />
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-md p-4 min-h-[300px] overflow-y-auto">
                <MarkdownPreview content={content || '*暂无内容*'} />
              </div>
            )}
          </div>
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
          <Button onClick={handleSave} loading={saving}>保存修改</Button>
        </div>
      </div>
    </div>
  );
}
