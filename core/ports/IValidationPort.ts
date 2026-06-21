/**
 * ============================================================
 * Port：IValidationPort
 * 描述：验证端口 — 定义配置验证的契约接口
 * 依赖方向：服务层 → 本端口（单向依赖）
 * 实现方：适配器层
 * ============================================================
 */

import type { OpenCodeConfig } from '../../shared/atoms';

/** 验证结果 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** 验证端口接口 */
export interface IValidationPort {
  /** 验证配置内容 */
  validate(config: OpenCodeConfig): ValidationResult;
}
