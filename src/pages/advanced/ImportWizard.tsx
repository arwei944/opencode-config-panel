/**
 * 配置导入向导组件
 * 文件选择 → 预览 → 确认三步导入流程
 */

import { useState, useRef } from 'react';
import { put } from '../../api/client';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { JsonPreview } from '../../components/common/JsonPreview';
import { DiffView } from '../../components/common/DiffView';
import { Toast } from '../../components/common/Toast';
import { useNotification } from '../../hooks/useNotification';

type Step = 'select' | 'preview' | 'confirm';

interface ImportWizardProps {
  /** 导入完成回调 */
  onComplete?: () => void;
  /** 当前配置数据（用于对比） */
  currentConfig?: unknown;
}

export function ImportWizard({ onComplete, currentConfig }: ImportWizardProps) {
  const [step, setStep] = useState<Step>('select');
  const [fileName, setFileName] = useState('');
  const [parsedConfig, setParsedConfig] = useState<unknown>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { notifications, success, error: notifyError, remove } = useNotification();

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = JSON.parse(text);
        setParsedConfig(parsed);
        setStep('preview');
      } catch {
        setParseError('文件不是有效的 JSON 格式，请确认后重试');
      }
    };
    reader.onerror = () => setParseError('文件读取失败');
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!parsedConfig) return;
    setImporting(true);
    try {
      await put('/config', parsedConfig);
      success('配置导入成功');
      setStep('confirm');
      onComplete?.();
    } catch (e) {
      notifyError((e as Error).message);
    } finally {
      setImporting(false);
    }
  }

  function handleReset() {
    setStep('select');
    setFileName('');
    setParsedConfig(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <Card title="导入配置">
      {/* 步骤指示器 */}
      <div className="flex items-center gap-2 mb-4">
        {(['select', 'preview', 'confirm'] as Step[]).map((s, i) => {
          const idx = ['select', 'preview', 'confirm'].indexOf(step);
          const isActive = i <= idx;
          return (
            <div key={s} className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${isActive ? 'bg-primary-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'}`}>
                {i + 1}
              </span>
              <span className={`text-xs ${isActive ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'}`}>
                {s === 'select' ? '选择文件' : s === 'preview' ? '预览对比' : '完成'}
              </span>
              {i < 2 && <span className="text-gray-300 dark:text-gray-600">→</span>}
            </div>
          );
        })}
      </div>

      {/* 步骤 1：选择文件 */}
      {step === 'select' && (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-primary-400 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <input ref={fileInputRef} type="file" accept=".json,.yaml,.yml" className="hidden" onChange={handleFileSelect} />
            <div className="text-3xl text-gray-300 dark:text-gray-600 mb-2">file_upload</div>
            <p className="text-sm text-gray-500 dark:text-gray-400">点击选择配置文件</p>
            <p className="text-xs text-gray-400 mt-1">支持 .json / .yaml / .yml 格式</p>
          </div>
          {parseError && <p className="text-sm text-red-500">{parseError}</p>}
        </div>
      )}

      {/* 步骤 2：预览对比 */}
      {step === 'preview' && !!parsedConfig && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">文件 <code className="text-primary-600 font-mono">{fileName}</code> 已解析，共 {JSON.stringify(parsedConfig).length.toLocaleString()} 字符</p>
          {!!currentConfig && (
            <DiffView oldData={currentConfig} newData={parsedConfig} title="与当前配置的差异" />
          )}
          <details>
            <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">查看导入内容</summary>
            <div className="mt-2">
              <JsonPreview data={parsedConfig} maxDepth={5} />
            </div>
          </details>
          <div className="flex items-center gap-3">
            <Button onClick={handleImport} loading={importing} icon="cloud_upload">确认导入</Button>
            <Button variant="outline" onClick={handleReset}>取消</Button>
          </div>
        </div>
      )}

      {/* 步骤 3：完成 */}
      {step === 'confirm' && (
        <div className="text-center py-6 space-y-3">
          <div className="text-3xl text-green-500">check_circle</div>
          <p className="text-sm text-gray-600 dark:text-gray-400">配置导入成功</p>
          <Button variant="outline" onClick={handleReset}>继续导入</Button>
        </div>
      )}

      <Toast notifications={notifications} onRemove={remove} />
    </Card>
  );
}
