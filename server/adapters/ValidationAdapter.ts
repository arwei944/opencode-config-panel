/**
 * ============================================================
 * 适配器：ValidationAdapter
 * 描述：配置验证逻辑适配为 IValidationPort 接口
 * 依赖方向：适配器 → IValidationPort（实现方）
 * ============================================================
 */

import type { IValidationPort, ValidationResult } from '../../core/ports';
import type { OpenCodeConfig } from '../../shared/atoms';

/**
 * ValidationAdapter
 * 适配纯验证逻辑 → IValidationPort
 */
export class ValidationAdapter implements IValidationPort {
  /** 验证配置内容 */
  validate(config: OpenCodeConfig): ValidationResult {
    const errors: string[] = [];

    // 验证模型格式 (provider/model)
    if (config.model && !/^[\w-]+\/[\w.-]+$/.test(config.model)) {
      errors.push('默认模型格式不正确，应为 "提供商/模型名" 格式');
    }
    if (config.small_model && !/^[\w-]+\/[\w.-]+$/.test(config.small_model)) {
      errors.push('小模型格式不正确，应为 "提供商/模型名" 格式');
    }

    // 验证 logLevel
    if (config.logLevel && !['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(config.logLevel)) {
      errors.push('logLevel 取值必须为 DEBUG、INFO、WARN 或 ERROR');
    }

    // 验证提供商配置
    if (config.provider) {
      for (const [name, provider] of Object.entries(config.provider)) {
        if (provider.options?.baseURL) {
          try {
            new URL(provider.options.baseURL);
          } catch {
            errors.push(`提供商 "${name}" 的 baseURL 格式不正确`);
          }
        }
      }
    }

    // 验证代理配置
    if (config.agent) {
      for (const [name, agent] of Object.entries(config.agent)) {
        if (agent.model && !/^[\w-]+\/[\w.-]+$/.test(agent.model)) {
          errors.push(`代理 "${name}" 的模型格式不正确`);
        }
        if (agent.temperature !== undefined && (agent.temperature < 0 || agent.temperature > 2)) {
          errors.push(`代理 "${name}" 的 temperature 取值范围为 0-2`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
