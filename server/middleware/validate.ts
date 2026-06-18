import type { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

/**
 * 请求验证中间件
 * 提供通用的参数校验工具
 */

/** 验证规则定义 */
interface ValidationRule {
  /** 字段名 */
  field: string;
  /** 是否必填 */
  required?: boolean;
  /** 最小长度（字符串） */
  minLength?: number;
  /** 最大长度（字符串） */
  maxLength?: number;
  /** 正则模式 */
  pattern?: RegExp;
  /** 自定义验证函数 */
  validate?: (value: unknown) => string | null;
}

/** 验证结果 */
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 创建请求体验证中间件
 * @param rules 验证规则列表
 */
export function validateBody(rules: ValidationRule[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    for (const rule of rules) {
      const value = req.body[rule.field];

      // 必填检查
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`字段 "${rule.field}" 不能为空`);
        continue;
      }

      if (value === undefined || value === null) {
        continue;
      }

      // 类型检查：字符串
      if (typeof value === 'string') {
        if (rule.minLength !== undefined && value.length < rule.minLength) {
          errors.push(`字段 "${rule.field}" 长度不能小于 ${rule.minLength}`);
        }
        if (rule.maxLength !== undefined && value.length > rule.maxLength) {
          errors.push(`字段 "${rule.field}" 长度不能大于 ${rule.maxLength}`);
        }
        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(`字段 "${rule.field}" 格式不正确`);
        }
      }

      // 自定义验证
      if (rule.validate) {
        const error = rule.validate(value);
        if (error) {
          errors.push(error);
        }
      }
    }

    if (errors.length > 0) {
      next(new AppError(400, 'VALIDATION_ERROR', errors.join('；')));
      return;
    }

    next();
  };
}

/**
 * 校验对象是否满足基础规则
 */
export function validateObject(
  obj: Record<string, unknown>,
  rules: ValidationRule[],
): ValidationResult {
  const errors: string[] = [];

  for (const rule of rules) {
    const value = obj[rule.field];

    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(`字段 "${rule.field}" 不能为空`);
      continue;
    }

    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value === 'string') {
      if (rule.minLength !== undefined && value.length < rule.minLength) {
        errors.push(`字段 "${rule.field}" 长度不能小于 ${rule.minLength}`);
      }
      if (rule.maxLength !== undefined && value.length > rule.maxLength) {
        errors.push(`字段 "${rule.field}" 长度不能大于 ${rule.maxLength}`);
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push(`字段 "${rule.field}" 格式不正确`);
      }
    }

    if (rule.validate) {
      const error = rule.validate(value);
      if (error) {
        errors.push(error);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
