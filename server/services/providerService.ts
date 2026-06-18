/**
 * 提供商管理服务
 * 负责提供商的 CRUD 操作和模型管理
 */

import { configService } from './configService';
import { AppError } from '../middleware/errorHandler';
import type { ProviderConfig, ModelConfig } from '../types';

class ProviderService {
  // ============================================================
  // 3.1.1 list() — 获取所有提供商
  // ============================================================
  async list(): Promise<Record<string, ProviderConfig>> {
    const config = await configService.getConfig();
    return config.provider || {};
  }

  // ============================================================
  // 3.1.2 add() — 添加提供商
  // ============================================================
  async add(name: string, providerConfig: ProviderConfig): Promise<ProviderConfig> {
    const config = await configService.getConfig();
    const providers = config.provider || {};

    // 名称重复检测
    if (providers[name]) {
      throw new AppError(409, 'DUPLICATE_NAME', `提供商 "${name}" 已存在`);
    }

    // 名称格式验证
    if (!/^[a-z0-9-]{2,32}$/.test(name)) {
      throw new AppError(400, 'VALIDATION_ERROR', '提供商名称必须为小写字母、数字、连字符，2-32 字符');
    }

    // 验证 baseURL 格式
    if (providerConfig.options?.baseURL) {
      try {
        new URL(providerConfig.options.baseURL);
      } catch {
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

    // 合并更新
    providers[name] = { ...providers[name], ...providerConfig };

    // 如果提供 models，合并 models
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

export const providerService = new ProviderService();
