/**
 * 钩子命令编辑器组件
 * 编辑命令链（命令数组 + 环境变量）
 */

import { KeyValueEditor } from '../../components/common/KeyValueEditor';

interface HookCommand {
  command: string[];
  environment?: Record<string, string>;
}

interface HookCommandEditorProps {
  /** 命令列表 */
  commands: HookCommand[];
  /** 变更回调 */
  onChange: (commands: HookCommand[]) => void;
}

/**
 * 钩子命令编辑器
 * 支持多命令编辑，每条命令包含命令数组和环境变量
 */
export function HookCommandEditor({ commands, onChange }: HookCommandEditorProps) {
  function updateCommand(index: number, commandStr: string) {
    const updated = commands.map((cmd, i) => {
      if (i === index) {
        return {
          ...cmd,
          command: commandStr.split(' ').filter(Boolean),
        };
      }
      return cmd;
    });
    onChange(updated);
  }

  function updateEnvironment(index: number, env: Record<string, string>) {
    const updated = commands.map((cmd, i) => {
      if (i === index) {
        return {
          ...cmd,
          environment: Object.keys(env).length > 0 ? env : undefined,
        };
      }
      return cmd;
    });
    onChange(updated);
  }

  function addCommand() {
    onChange([...commands, { command: [] }]);
  }

  function removeCommand(index: number) {
    onChange(commands.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">命令链</label>

      {commands.map((cmd, index) => (
        <div key={index} className="p-3 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">命令 #{index + 1}</span>
            {commands.length > 1 && (
              <button
                type="button"
                onClick={() => removeCommand(index)}
                className="text-xs text-red-400 hover:text-red-500"
              >
                删除
              </button>
            )}
          </div>

          <div className="space-y-2">
            {/* 命令输入 */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">命令</label>
              <input
                type="text"
                value={cmd.command.join(' ')}
                onChange={e => updateCommand(index, e.target.value)}
                placeholder="npx biome format --write"
                className="w-full px-2.5 py-1.5 text-sm font-mono rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="text-xs text-gray-400 mt-0.5">
                输入完整命令，用空格分隔参数
              </p>
            </div>

            {/* 环境变量 */}
            <div>
              <KeyValueEditor
                label="环境变量（可选）"
                value={cmd.environment || {}}
                onChange={env => updateEnvironment(index, env)}
                keyPlaceholder="变量名"
                valuePlaceholder="值"
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addCommand}
        className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
      >
        <span className="icon text-lg leading-none">add</span>
        添加命令
      </button>
    </div>
  );
}
