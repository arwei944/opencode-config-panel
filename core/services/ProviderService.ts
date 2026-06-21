/**
 * ============================================================
 * 服务：ProviderService
 * 描述：提供商管理核心服务 — 纯业务逻辑
 * 依赖：IConfigPort（配置读写）、IConnectionTestPort（连接测试）
 * 约束：仅通过 Port 接口与外部交互
 * ============================================================
 */

import type { IConfigPort, IConnectionTestPort } from '../ports';
import type {
  ProviderConfig,
  ModelConfig,
  DetectResult,
  SmartAddResult,
} from '../../shared/atoms';

// 已知模型定义（Atom — 不可变）
const KNOWN_MODELS: Readonly<Record<string, Record<string, ModelConfig>>> = Object.freeze({
  opencode: Object.freeze({
    'big-pickle': Object.freeze({ id: 'big-pickle', name: 'Big Pickle', context: 128000 } as ModelConfig),
    'deepseek-v4-flash-free': Object.freeze({ id: 'deepseek-v4-flash-free', name: 'DeepSeek V4 Flash Free', context: 128000 } as ModelConfig),
    'mimo-v2.5-free': Object.freeze({ id: 'mimo-v2.5-free', name: 'Mimo v2.5 Free', context: 128000 } as ModelConfig),
    'nemotron-3-ultra-free': Object.freeze({ id: 'nemotron-3-ultra-free', name: 'Nemotron 3 Ultra Free', context: 128000 } as ModelConfig),
    'north-mini-code-free': Object.freeze({ id: 'north-mini-code-free', name: 'North Mini Code Free', context: 128000 } as ModelConfig),
  }),
});

// 账户名 → 提供商名映射（Atom — 不可变）
const ACCOUNT_TO_PROVIDER: Readonly<Record<string, string>> = Object.freeze({
  'agnes-ai': 'opencode',
});

/** 提供商服务构造参数 */
export interface ProviderServiceOptions {
  configPort: IConfigPort;
  connectionTestPort: IConnectionTestPort;
  /** auth.json 读取函数（由适配器注入） */
  readAuthAccounts?: () => Promise<Record<string, { type: string; key: string }>>;
  /** account.json 读取函数（由适配器注入） */
  readAccountData?: () => Promise<Record<string, { serviceID?: string; credential?: { type?: string; key?: string } }>>;
}

/**
 * ProviderService — 提供商管理核心服务
 */
export class ProviderService {
  private configPort: IConfigPort;
  private connectionTestPort: IConnectionTestPort;
  private readAuthAccounts?: () => Promise<Record<string, { type: string; key: string }>>;
  private readAccountData?: () => Promise<Record<string, { serviceID?: string; credential?: { type?: string; key?: string } }>>;

  constructor(options: ProviderServiceOptions) {
    this.configPort = options.configPort;
    this.connectionTestPort = options.connectionTestPort;
    this.readAuthAccounts = options.readAuthAccounts;
    this.readAccountData = options.readAccountData;
  }

  /**
   * 列出所有提供商（合并多个数据源）
   * 组合器：opencode.json + auth.json + account.json → 统一列表
   */
  async list(): Promise<Record<string, ProviderConfig>> {
    const config = await this.configPort.read();
    const jsonProviders = config.provider || {};
    const mappedProviders: Record<string, ProviderConfig> = {};

    // 1. 从 auth.json 读取凭证账户（由适配器注入）
    if (this.readAuthAccounts) {
      const authAccounts = await this.readAuthAccounts();
      for (const [accountName, cred] of Object.entries(authAccounts)) {
        const providerName = ACCOUNT_TO_PROVIDER[accountName] || accountName;
        // 类型扩展仅在合并层使用，不污染原子类型
        mappedProviders[providerName] = {
          ...(mappedProviders[providerName] || {}),
          type: cred.type || 'api',
          options: {
            apiKey: cred.key || '',
            ...(providerName !== 'opencode' ? {} : { baseURL: undefined }),
          },
          name: providerName,
          models: KNOWN_MODELS[providerName]
            ? { ...KNOWN_MODELS[providerName] }
            : undefined,
        };
      }
    }

    // 2. 从 account.json 补充
    if (this.readAccountData) {
      const accountData = await this.readAccountData();
      for (const [, acc] of Object.entries(accountData)) {
        const serviceID = acc.serviceID;
        if (!serviceID) continue;
        const providerName = ACCOUNT_TO_PROVIDER[serviceID] || serviceID;
        if (!mappedProviders[providerName]) {
          mappedProviders[providerName] = {
            type: acc.credential?.type || 'api',
            options: { apiKey: acc.credential?.key || '' },
            name: providerName,
            models: KNOWN_MODELS[providerName]
              ? { ...KNOWN_MODELS[providerName] }
              : undefined,
          };
        }
      }
    }

    // 3. 合并 opencode.json 中的提供商配置（补充/覆盖）
    for (const [name, p] of Object.entries(jsonProviders)) {
      mappedProviders[name] = { ...(mappedProviders[name] || {}), ...p, name };
    }

    return mappedProviders;
  }

  /** 获取单个提供商 */
  async get(name: string): Promise<ProviderConfig | undefined> {
    const providers = await this.list();
    return providers[name];
  }

  /** 添加提供商 */
  async add(name: string, providerConfig: ProviderConfig): Promise<ProviderConfig> {
    if (!/^[a-z0-9-]{2,32}$/.test(name)) {
      throw new Error('提供商名称必须为小写字母、数字、连字符，2-32 字符');
    }
    if (providerConfig.options?.baseURL) {
      try { new URL(providerConfig.options.baseURL); } catch {
        throw new Error('baseURL 格式不正确');
      }
    }

    const config = await this.configPort.read();
    const providers = config.provider || {};

    if (providers[name]) {
      throw new Error(`提供商 "${name}" 已存在`);
    }

    providers[name] = providerConfig;
    await this.configPort.write({ ...config, provider: providers });
    return providerConfig;
  }

  /** 更新提供商 */
  async update(name: string, providerConfig: Partial<ProviderConfig>): Promise<ProviderConfig> {
    const config = await this.configPort.read();
    const providers = config.provider || {};

    if (!providers[name]) {
      throw new Error(`提供商 "${name}" 不存在`);
    }

    providers[name] = { ...providers[name], ...providerConfig };
    if (providerConfig.models) {
      providers[name].models = {
        ...(providers[name].models || {}),
        ...providerConfig.models,
      };
    }

    await this.configPort.write({ ...config, provider: providers });
    return providers[name];
  }

  /** 删除提供商 */
  async delete(name: string): Promise<void> {
    const config = await this.configPort.read();
    const providers = config.provider || {};

    if (!providers[name]) {
      throw new Error(`提供商 "${name}" 不存在`);
    }

    delete providers[name];
    await this.configPort.write({ ...config, provider: providers });
  }

  /** 智能探测提供商 */
  async detect(baseURL: string, apiKey?: string): Promise<DetectResult> {
    return this.connectionTestPort.detect(baseURL, apiKey);
  }

  /** 智能添加（探测 + 写入） */
  async smartAdd(baseURL: string, apiKey?: string): Promise<SmartAddResult> {
    const detected = await this.connectionTestPort.detect(baseURL, apiKey || '');
    const providerConfig: ProviderConfig = {
      type: detected.type,
      options: {
        baseURL,
        ...(apiKey ? { apiKey } : {}),
      },
      models: detected.models,
    };

    const config = await this.configPort.read();
    const providers = config.provider || {};
    providers[detected.name] = providerConfig;
    await this.configPort.write({ ...config, provider: providers });

    return { name: detected.name, config: providerConfig };
  }

  /** 添加模型 */
  async addModel(providerName: string, modelKey: string, modelConfig: ModelConfig): Promise<ModelConfig> {
    const config = await this.configPort.read();
    const providers = config.provider || {};

    if (!providers[providerName]) {
      throw new Error(`提供商 "${providerName}" 不存在`);
    }

    const models = providers[providerName].models || {};
    if (models[modelKey]) {
      throw new Error(`模型 "${modelKey}" 已存在`);
    }

    models[modelKey] = modelConfig;
    providers[providerName].models = models;
    await this.configPort.write({ ...config, provider: providers });
    return modelConfig;
  }

  /** 批量更新模型 */
  async batchUpdateModels(providerName: string, models: Record<string, ModelConfig>): Promise<Record<string, ModelConfig>> {
    const config = await this.configPort.read();
    const providers = config.provider || {};

    if (!providers[providerName]) {
      throw new Error(`提供商 "${providerName}" 不存在`);
    }

    providers[providerName].models = models;
    await this.configPort.write({ ...config, provider: providers });
    return models;
  }

  /** 删除模型 */
  async deleteModel(providerName: string, modelKey: string): Promise<void> {
    const config = await this.configPort.read();
    const providers = config.provider || {};

    if (!providers[providerName]) {
      throw new Error(`提供商 "${providerName}" 不存在`);
    }

    const models = providers[providerName].models || {};
    if (!models[modelKey]) {
      throw new Error(`模型 "${modelKey}" 不存在`);
    }

    delete models[modelKey];
    providers[providerName].models = models;
    await this.configPort.write({ ...config, provider: providers });
  }

  /** 获取已知模型列表（原子数据） */
  static getKnownModels(): Readonly<Record<string, Readonly<Record<string, ModelConfig>>>> {
    return KNOWN_MODELS;
  }

  /** 获取账户映射表（原子数据） */
  static getAccountToProviderMap(): Readonly<Record<string, string>> {
    return ACCOUNT_TO_PROVIDER;
  }
}
