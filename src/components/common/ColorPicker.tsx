/**
 * 颜色选择器组件
 * 预设色板 + 自定义 hex 输入
 */

import { useState } from 'react';

interface ColorPickerProps {
  /** 当前颜色值 */
  value: string;
  /** 变更回调 */
  onChange: (color: string) => void;
  /** 标签文字 */
  label?: string;
}

/** 预置颜色列表 */
const PRESET_COLORS = [
  '#3b82f6', '#2563eb', '#7c3aed', '#d946ef', '#ec4899',
  '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#06b6d4', '#6366f1', '#8b5cf6', '#a855f7',
  '#64748b', '#6b7280', '#78716c', '#020617', '#ffffff',
];

/**
 * 颜色选择器组件
 * @example
 * <ColorPicker value="#3b82f6" onChange={setColor} label="主题色" />
 */
export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const [customHex, setCustomHex] = useState(value);
  const [showCustom, setShowCustom] = useState(false);

  function handlePresetClick(color: string) {
    onChange(color);
    setCustomHex(color);
    setShowCustom(false);
  }

  function handleCustomChange(hex: string) {
    setCustomHex(hex);
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      onChange(hex);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      )}
      {/* 预设色板 */}
      <div className="flex flex-wrap gap-1.5">
        {PRESET_COLORS.map(color => (
          <button
            key={color}
            type="button"
            onClick={() => handlePresetClick(color)}
            title={color}
            className={`
              w-6 h-6 rounded-full border-2 transition-transform hover:scale-110
              ${value === color ? 'border-gray-900 dark:border-gray-100 scale-110' : 'border-transparent'}
            `}
            style={{ backgroundColor: color }}
            aria-label={`颜色 ${color}`}
          />
        ))}
        <button
          type="button"
          onClick={() => setShowCustom(!showCustom)}
          className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-xs text-gray-400 hover:border-gray-500"
          title="自定义颜色"
        >
          +
        </button>
      </div>
      {/* 自定义 Hex 输入 */}
      {showCustom && (
        <div className="flex items-center gap-2 mt-1">
          <div className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600" style={{ backgroundColor: customHex }} />
          <input
            type="text"
            value={customHex}
            onChange={e => handleCustomChange(e.target.value)}
            placeholder="#000000"
            maxLength={7}
            className="px-2 py-1 text-xs font-mono rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 w-24 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      )}
    </div>
  );
}
