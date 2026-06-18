/**
 * 深度合并工具
 * 递归合并两个对象，处理数组和嵌套对象
 */

/**
 * 检查值是否为普通对象
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 深度合并两个对象
 * @param target 目标对象
 * @param source 源对象（优先级更高）
 * @returns 合并后的新对象
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>,
): T {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const targetValue = result[key];
    const sourceValue = source[key];

    if (sourceValue === undefined) {
      continue;
    }

    // 如果源值为 null，显式设置为 null
    if (sourceValue === null) {
      result[key] = null as unknown as T[Extract<keyof T, string>];
      continue;
    }

    // 如果两个值都是普通对象，递归合并
    if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
      ) as unknown as T[Extract<keyof T, string>];
      continue;
    }

    // 其他情况（基本类型、数组等），直接覆盖
    result[key] = sourceValue as T[Extract<keyof T, string>];
  }

  return result;
}

/**
 * 深度克隆对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepClone) as unknown as T;
  }

  const cloned: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    cloned[key] = deepClone((obj as Record<string, unknown>)[key]);
  }

  return cloned as T;
}
