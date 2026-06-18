/**
 * 事件钩子页面
 * 管理文件编辑钩子和会话完成钩子
 */

import { useState, useEffect, useCallback } from 'react';
import {
  fetchHooks,
  addFileEditedHook,
  deleteFileEditedHook,
  addSessionCompletedHook,
  deleteSessionCompletedHook,
} from '../../api/hooks';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Loading } from '../../components/common/Loading';
import { EmptyState } from '../../components/common/EmptyState';
import { JsonPreview } from '../../components/common/JsonPreview';
import { Toast } from '../../components/common/Toast';
import { useNotification } from '../../hooks/useNotification';
import { HookCommandEditor } from './HookCommandEditor';

interface FileEditedEntry {
  extensions: string;
  commands: { command: string[]; environment?: Record<string, string> }[];
}

/**
 * 事件钩子页面
 */
export function HooksPage() {
  const [fileEditedEntries, setFileEditedEntries] = useState<FileEditedEntry[]>([]);
  const [sessionCommands, setSessionCommands] = useState<{ command: string[]; environment?: Record<string, string> }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 添加新条目
  const [newExtensions, setNewExtensions] = useState('');
  const [newCommands, setNewCommands] = useState<{ command: string[]; environment?: Record<string, string> }[]>([
    { command: [] },
  ]);

  // 新会话完成命令
  const [newSessionCommand, setNewSessionCommand] = useState<string[]>(['']);

  const { notifications, success, error: notifyError, remove } = useNotification();

  const loadHooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHooks();
      // 转换 file_edited 对象为数组
      const entries: FileEditedEntry[] = [];
      if (data.file_edited) {
        for (const [extensions, commands] of Object.entries(data.file_edited)) {
          entries.push({ extensions, commands });
        }
      }
      setFileEditedEntries(entries);
      setSessionCommands(data.session_completed || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载钩子配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHooks();
  }, [loadHooks]);

  /** 添加文件编辑钩子 */
  async function handleAddFileEdited() {
    if (!newExtensions.trim()) {
      notifyError('请输入文件扩展名');
      return;
    }
    try {
      await addFileEditedHook(newExtensions.trim(), newCommands);
      success(`已添加 ${newExtensions} 的编辑钩子`);
      setNewExtensions('');
      setNewCommands([{ command: [] }]);
      loadHooks();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : '添加失败');
    }
  }

  /** 删除文件编辑钩子 */
  async function handleDeleteFileEdited(extensions: string) {
    try {
      await deleteFileEditedHook(extensions);
      success(`已删除 ${extensions} 的编辑钩子`);
      loadHooks();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : '删除失败');
    }
  }

  /** 添加会话完成钩子 */
  async function handleAddSessionCompleted() {
    const validCommands = newSessionCommand.filter(c => c.trim());
    if (validCommands.length === 0) {
      notifyError('请输入命令');
      return;
    }
    try {
      await addSessionCompletedHook(validCommands);
      success('已添加会话完成钩子');
      setNewSessionCommand(['']);
      loadHooks();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : '添加失败');
    }
  }

  /** 删除会话完成钩子 */
  async function handleDeleteSessionCompleted(index: number) {
    try {
      await deleteSessionCompletedHook(index);
      success('已删除会话完成钩子');
      loadHooks();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : '删除失败');
    }
  }

  if (loading) return <Loading text="正在加载钩子配置..." />;

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={loadHooks}>重试</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">事件钩子</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          配置在特定事件触发时自动执行的命令
        </p>
      </div>

      {/* 文件编辑钩子 */}
      <Card title="文件编辑钩子（file_edited）">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          当指定扩展名的文件被编辑后自动执行命令
        </p>

        {fileEditedEntries.length === 0 ? (
          <EmptyState icon="sync" title="暂无文件编辑钩子" description="添加一个扩展名组来开始" />
        ) : (
          <div className="space-y-3 mb-4">
            {fileEditedEntries.map(entry => (
              <div key={entry.extensions} className="p-3 rounded-md bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-primary-600 font-mono">
                    {entry.extensions}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="delete"
                    onClick={() => handleDeleteFileEdited(entry.extensions)}
                  >
                    删除
                  </Button>
                </div>
                <div className="space-y-1">
                  {entry.commands.map((cmd, i) => (
                    <div key={i} className="text-xs font-mono text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded">
                      <span className="text-gray-400">$ </span>
                      {cmd.command.join(' ')}
                      {cmd.environment && Object.keys(cmd.environment).length > 0 && (
                        <span className="text-gray-400 ml-2">
                          env: {JSON.stringify(cmd.environment)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 添加新文件编辑钩子 */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">添加新的文件编辑钩子</h4>
          <div className="space-y-3">
            <Input
              label="文件扩展名"
              value={newExtensions}
              onChange={e => setNewExtensions(e.target.value)}
              placeholder=".ts,.tsx,.js"
              helpText="多个扩展名用逗号分隔"
            />
            <HookCommandEditor
              commands={newCommands}
              onChange={setNewCommands}
            />
            <Button onClick={handleAddFileEdited} icon="add">
              添加钩子
            </Button>
          </div>
        </div>
      </Card>

      {/* 会话完成钩子 */}
      <Card title="会话完成钩子（session_completed）">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          每次 AI 会话完成后自动执行命令
        </p>

        {sessionCommands.length === 0 ? (
          <EmptyState icon="done_all" title="暂无会话完成钩子" description="添加一个命令来开始" />
        ) : (
          <div className="space-y-2 mb-4">
            {sessionCommands.map((cmd, index) => (
              <div key={index} className="flex items-center justify-between p-2 rounded-md bg-gray-50 dark:bg-gray-800/50">
                <div className="text-sm font-mono text-gray-700 dark:text-gray-300">
                  <span className="text-gray-400">$ </span>
                  {cmd.command.join(' ')}
                  {cmd.environment && (
                    <span className="text-xs text-gray-400 ml-2">
                      env: {JSON.stringify(cmd.environment)}
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  icon="delete"
                  onClick={() => handleDeleteSessionCompleted(index)}
                />
              </div>
            ))}
          </div>
        )}

        {/* 添加新会话完成钩子 */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">添加新的会话完成钩子</h4>
          <div className="space-y-3">
            <Input
              label="命令"
              value={newSessionCommand[0]}
              onChange={e => {
                const updated = [...newSessionCommand];
                updated[0] = e.target.value;
                setNewSessionCommand(updated);
              }}
              placeholder="git add -A"
              helpText="输入完整的命令"
            />
            <Button onClick={handleAddSessionCompleted} icon="add">
              添加命令
            </Button>
          </div>
        </div>
      </Card>

      {/* JSON 预览 */}
      <Card title="实时预览">
        <JsonPreview
          data={{
            file_edited: Object.fromEntries(
              fileEditedEntries.map(e => [e.extensions, e.commands])
            ),
            session_completed: sessionCommands,
          }}
        />
      </Card>

      <Toast notifications={notifications} onRemove={remove} />
    </div>
  );
}
