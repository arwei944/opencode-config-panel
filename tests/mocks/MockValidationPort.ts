/**
 * Mock: IValidationPort
 * 用于单元测试的验证端口模拟实现
 */

import type { IValidationPort } from '../../core/ports';

export class MockValidationPort implements IValidationPort {
  private shouldBeValid = true;
  private customErrors: string[] = [];

  setValid(valid: boolean): void {
    this.shouldBeValid = valid;
  }

  setErrors(errors: string[]): void {
    this.customErrors = errors;
  }

  validate(config: unknown): { valid: boolean; errors: string[] } {
    if (!this.shouldBeValid) {
      return { valid: false, errors: this.customErrors.length > 0 ? this.customErrors : ['模拟验证失败'] };
    }
    return { valid: true, errors: [] };
  }
}
