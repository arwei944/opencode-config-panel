/**
 * 提供商管理服务
 * 从多个真实数据源读取提供商和模型信息：
 *   - opencode.json -> 手动定义的提供商 + 模型列表
 *   - auth.json    -> 凭证登录的提供商（账户名 → 提供商名映射）
 *   - account.json -> 账户注册的提供商
 *
 * 提供商名称说明：
 *   auth.json 中存的是 账户名（如 agnes-ai），
 *   但实际提供商标识是 opencode（模型格式 opencode/*）。
 *   list() 时自动将账户映射为对应的提供商名。
 */

import fs from 'node:fs/promises';
import { configService } from './configService';
import { getAuthPath, getAccountPath } from '../utils/paths';
import { AppError } from '../middleware/errorHandler';
import type { ProviderConfig, ModelConfig } from '../types';

// ============================================================
// 账户名 → 提供商名 映射表
// auth.json 的 key 是账户名，但模型使用 "提供商/模型" 格式
// ============================================================
const ACCOUNT_TO_PROVIDER: Record<string, string> = {
  'agnes-ai': 'opencode',
};

// ============================================================
// 各提供商的已知模型定义
// ============================================================
const KNOWN_MODELS: Record<string, Record<string, ModelConfig>> = {
  opencode: {
    'big-pickle': { id: 'big-pickle', name: 'Big Pickle', context: 128000 },
    'deepseek-v4-flash-free': { id: 'deepseek-v4-flash-free', name: 'DeepSeek V4 Flash Free', context: 128000 },
    'mimo-v2.5-free': { id: 'mimo-v2.5-free', name: 'Mimo v2.5 Free', context: 128000 },
    'nemotron-3-ultra-free': { id: 'nemotron-3-ultra-free', name: 'Nemotron 3 Ultra Free', context: 128000 },
    'north-mini-code-free': { id: 'north-mini-code-free', name: 'North Mini Code Free', context: 128000 },
  },
};

// ============================================================
// URL 域名 → 提供商类型 探测规则
// ============================================================
const URL_PROVIDER_TYPES: Array<{ pattern: RegExp; type: string; name: string }> = [
  { pattern: /openai\.com/i, type: 'openai', name: 'openai' },
  { pattern: /anthropic\.com/i, type: 'anthropic', name: 'anthropic' },
  { pattern: /googleapis\.com/i, type: 'google', name: 'google' },
  { pattern: /deepseek\.com/i, type: 'openai', name: 'deepseek' },
  { pattern: /azure\.com/i, type: 'openai', name: 'azure' },
  { pattern: /github\.com/i, type: 'openai', name: 'github' },
];

/** 从 auth.json 读取凭证账户 */
async function readAuthAccounts(): Promise<Record<string, { type: string; key: string }>> {
  try {
    const raw = await fs.readFile(getAuthPath(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** 从 account.json 读取账户信息 */
async function readAccountData(): Promise<Record<string, { serviceID?: string; credential?: { type?: string; key?: string } }>> {
  try {
    const raw = await fs.readFile(getAccountPath(), 'utf-8');
    const account = JSON.parse(raw);
    return account.accounts || {};
  } catch {
    return {};
  }
}

/**
 * 智能探测：根据 baseURL + apiKey 自动识别提供商
 */
async function smartDetectProvider(baseURL: string, apiKey: string): Promise<{
  name: string;
  type: string;
  models: Record<string, ModelConfig>;
}> {
  // 规范化 URL
  const url = baseURL.replace(/\/+$/, '');
  let providerType = 'openai'; // 默认 OpenAI 兼容
  let providerName = 'custom';

  // 1. 从 URL 探测提供商类型
  for (const rule of URL_PROVIDER_TYPES) {
    if (rule.pattern.test(url)) {
      providerType = rule.type;
      providerName = rule.name;
      break;
    }
  }

  // 2. 从 URL 域名自动生成提供商名称
  if (providerName === 'custom') {
    try {
      const hostname = new URL(url).hostname;
      providerName = hostname.replace(/^www\./, '').split('.')[0].toLowerCase().replace(/[^a-z0-9-]/g, '');
    } catch {
      providerName = 'custom';
    }
  }

  // 3. 尝试从提供商 API 拉取模型列表
  const models: Record<string, ModelConfig> = {};
  try {
    const response = await fetch(`${url}/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      const data = await response.json() as { data?: Array<{ id: string; name?: string; object?: string }> };
      const modelList = data.data || [];

      for (const m of modelList) {
        if (m.object === 'model' || !m.object) {
          const modelId = m.id;
          // 去掉可能的提供商前缀
          const key = modelId.replace(`${providerName}/`, '').replace(`${providerType}/`, '');
          models[key] = {
            id: modelId,
            name: m.name || modelId,
          };
        }
      }
    }
  } catch {
    // API 调用失败，使用已知模型或留空
  }

  // 4. 如果没拉到模型，检查是否有已知模型
  if (Object.keys(models).length === 0 && KNOWN_MODELS[providerName]) {
    Object.assign(models, KNOWN_MODELS[providerName]);
  }

  // 5. 如果仍然没有模型，添加一个占位
  if (Object.keys(models).length === 0) {
    models['default'] = { id: `${providerName}/default`, name: 'Default Model' };
  }

  return { name: providerName, type: providerType, models };
}

class ProviderService {
  // ============================================================
  // 3.1.1 list() — 获取所有提供商（合并多个数据源）
  // ============================================================
  async list(): Promise<Record<string, ProviderConfig>> {
    // 1. 从 opencode.json 读取手动定义的提供商
    const config = await configService.getConfig();
    const jsonProviders = config.provider || {};

    // 2. 从 auth.json 读取凭证账户，映射为提供商
    const authAccounts = await readAuthAccounts();
    const mappedProviders: Record<string, ProviderConfig> = {};

    for (const [accountName, cred] of Object.entries(authAccounts)) {
      // 账户名 → 提供商名 映射
      const providerName = ACCOUNT_TO_PROVIDER[accountName] || accountName;

      mappedProviders[providerName] = {
        type: cred.type || 'api',
        options: {
          apiKey: cred.key || '',
          // 对于 opencode，隐藏真实 baseURL（由 opencode CLI 管理）
          ...(providerName !== 'opencode' ? {} : { baseURL: undefined }),
        },
        // 附加账户信息供前端展示
        name: providerName,
        _accountName: accountName,
        // 添加已知模型
        models: KNOWN_MODELS[providerName] ? { ...KNOWN_MODELS[providerName] } : undefined,
      } as ProviderConfig & { _accountName?: string };
    }

    // 3. 从 account.json 补充
    const accountData = await readAccountData();
    for (const [accId, acc] of Object.entries(accountData)) {
      const serviceID = acc.serviceID;
      if (!serviceID) continue;
      const providerName = ACCOUNT_TO_PROVIDER[serviceID] || serviceID;

      if (!mappedProviders[providerName]) {
        mappedProviders[providerName] = {
          type: acc.credential?.type || 'api',
          options: { apiKey: acc.credential?.key || '' },
          name: providerName,
          _accountName: serviceID,
          models: KNOWN_MODELS[providerName] ? { ...KNOWN_MODELS[providerName] } : undefined,
        } as ProviderConfig & { _accountName?: string };
      }
    }

    // 4. 合并 opencode.json 中的提供商配置（补充/覆盖）
    for (const [name, p] of Object.entries(jsonProviders)) {
      mappedProviders[name] = { ...(mappedProviders[name] || {}), ...p, name };
    }

    return mappedProviders;
  }

  // ============================================================
  // 智能探测 API
  // ============================================================
  async detect(baseURL: string, apiKey?: string): Promise<{
    name: string;
    type: string;
    models: Record<string, ModelConfig>;
  }> {
    return smartDetectProvider(baseURL, apiKey || '');
  }

  // ============================================================
  // 智能添加：探测 + 直接写入 opencode.json
  // ============================================================
  async smartAdd(baseURL: string, apiKey?: string): Promise<{
    name: string;
    config: ProviderConfig;
  }> {
    const { name, type, models } = await smartDetectProvider(baseURL, apiKey || '');

    const providerConfig: ProviderConfig = {
      type,
      options: {
        baseURL,
        ...(apiKey ? { apiKey } : {}),
      },
      models,
    };

    // 写入 opencode.json
    const config = await configService.getConfig();
    const providers = config.provider || {};

    providers[name] = providerConfig;
    await configService.updateConfig({ provider: providers });

    return { name, config: providerConfig };
  }

  // ============================================================
  // 3.1.2 add() — 添加提供商（写入 opencode.json）
  // ============================================================
  async add(name: string, providerConfig: ProviderConfig): Promise<ProviderConfig> {
    const config = await configService.getConfig();
    const providers = config.provider || {};

    if (providers[name]) {
      throw new AppError(409, 'DUPLICATE_NAME', `提供商 "${name}" 已存在`);
    }

    if (!/^[a-z0-9-]{2,32}$/.test(name)) {
      throw new AppError(400, 'VALIDATION_ERROR', '提供商名称必须为小写字母、数字、连字符，2-32 字符');
    }

    if (providerConfig.options?.baseURL) {
      try { new URL(providerConfig.options.baseURL); } catch {
        throw new AppError(400, 'VALIDATION_ERROR', 'baseURL 格式不正确');
      }
    }

    providers[name] = providerConfig;
    await configService.updateConfig({ provider: providers });
    return providerConfig;
  }

  // ============================================================
  // 3.1.3 update() — 更新提供商
  // ============================================================
  async update(name: string, providerConfig: Partial<ProviderConfig>): Promise<ProviderConfig> {
    const config = await configService.getConfig();
    const providers = config.provider || {};

    if (!providers[name]) {
      throw new AppError(404, 'FILE_NOT_FOUND', `提供商 "${name}" 不存在`);
    }

    providers[name] = { ...providers[name], ...providerConfig };

    if (providerConfig.models) {
      providers[name].models = {
        ...(providers[name].models || {}),
        ...providerConfig.models,
      };
    }

    await configService.updateConfig({ provider: providers });
    return providers[name];
  }

  // ============================================================
  // 3.1.4 delete() — 删除提供商
  // ============================================================
  async delete(name: string): Promise<void> {
    const config = await configService.getConfig();
    const providers = config.provider || {};

    if (!providers[name]) {
      throw new AppError(404, 'FILE_NOT_FOUND', `提供商 "${name}" 不存在`);
    }

    delete providers[name];
    await configService.updateConfig({ provider: providers });
  }

  // ============================================================
  // 3.1.6 addModel() — 添加模型
  // ============================================================
  async addModel(providerName: string, modelKey: string, modelConfig: ModelConfig): Promise<ModelConfig> {
    const config = await configService.getConfig();
    const providers = config.provider || {};

    if (!providers[providerName]) {
      throw new AppError(404, 'FILE_NOT_FOUND', `提供商 "${providerName}" 不存在`);
    }

    const provider = providers[providerName];
    const models = provider.models || {};

    if (models[modelKey]) {
      throw new AppError(409, 'DUPLICATE_NAME', `模型 "${modelKey}" 已存在`);
    }

    models[modelKey] = modelConfig;
    provider.models = models;
    providers[providerName] = provider;

    await configService.updateConfig({ provider: providers });
    return modelConfig;
  }

  // ============================================================
  // 3.1.7 batchUpdateModels() — 批量更新模型
  // ============================================================
  async batchUpdateModels(
    providerName: string,
    models: Record<string, ModelConfig>,
  ): Promise<Record<string, ModelConfig>> {
    const config = await configService.getConfig();
    const providers = config.provider || {};

    if (!providers[providerName]) {
      throw new AppError(404, 'FILE_NOT_FOUND', `提供商 "${providerName}" 不存在`);
    }

    providers[providerName].models = models;
    await configService.updateConfig({ provider: providers });
    return models;
  }

  // ============================================================
  // 3.1.8 deleteModel() — 删除模型
  // ============================================================
  async deleteModel(providerName: string, modelKey: string): Promise<void> {
    const config = await configService.getConfig();
    const providers = config.provider || {};

    if (!providers[providerName]) {
      throw new AppError(404, 'FILE_NOT_FOUND', `提供商 "${providerName}" 不存在`);
    }

    const models = providers[providerName].models || {};
    if (!models[modelKey]) {
      throw new AppError(404, 'FILE_NOT_FOUND', `模型 "${modelKey}" 不存在`);
    }

    delete models[modelKey];
    providers[providerName].models = models;
    await configService.updateConfig({ provider: providers });
  }
}

export { smartDetectProvider };
export const providerService = new ProviderService();
