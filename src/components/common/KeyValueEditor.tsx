/**
 * 键值对编辑器组件
 * 动态添加、编辑、删除键值对行
 */

interface KeyValueEditorProps {
  /** 键值对列表 */
  value: Record<string, string>;
  /** 变更回调 */
  onChange: (value: Record<string, string>) => void;
  /** 标签文字 */
  label?: string;
  /** key 列的占位文字 */
  keyPlaceholder?: string;
  /** value 列的占位文字 */
  valuePlaceholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 动态键值对编辑器
 * @example
 * <KeyValueEditor value={{NODE_ENV:'production'}} onChange={setEnv} label="环境变量" />
 */
export function KeyValueEditor({
  value,
  onChange,
  label,
  keyPlaceholder = '键',
  valuePlaceholder = '值',
  disabled = false,
}: KeyValueEditorProps) {
  const entries = Object.entries(value);

  function updateEntry(index: number, field: 'key' | 'value', newValue: string) {
    const newEntries = [...entries];
    newEntries[index] = field === 'key'
      ? [newValue, newEntries[index][1]]
      : [newEntries[index][0], newValue];
    onChange(Object.fromEntries(newEntries));
  }

  function addEntry() {
    onChange({ ...value, '': '' });
  }

  function removeEntry(key: string) {
    const { [key]: _, ...rest } = value;
    onChange(rest);
  }

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      )}
      <div className="space-y-1.5">
        {entries.map(([key, val], index) => (
          <div key={index} className="flex items-center gap-1.5">
            <input
              type="text"
              value={key}
              onChange={e => updateEntry(index, 'key', e.target.value)}
              placeholder={keyPlaceholder}
              disabled={disabled}
              className="flex-1 px-2.5 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <span className="text-gray-400">=</span>
            <input
              type="text"
              value={val}
              onChange={e => updateEntry(index, 'value', e.target.value)}
              placeholder={valuePlaceholder}
              disabled={disabled}
              className="flex-1 px-2.5 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => removeEntry(key)}
                className="p-1 text-gray-400 hover:text-red-500 rounded"
                aria-label="删除此行"
              >
                <span className="icon text-lg leading-none">remove_circle</span>
              </button>
            )}
          </div>
        ))}
        {!disabled && (
          <button
            type="button"
            onClick={addEntry}
            className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
          >
            <span className="icon text-lg leading-none">add</span>
            添加条目
          </button>
        )}
      </div>
    </div>
  );
}
