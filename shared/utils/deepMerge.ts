/**
 * ============================================================
 * 工具：deepMerge
 * 描述：深度合并与克隆工具（原子 — 纯函数，无副作用）
 * 位置：共享层，供所有层使用
 * 约束：不可变，不修改输入对象
 * ============================================================
 */

/** 检查是否为普通对象 */
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
  const result: Record<string, unknown> = { ...target };

  for (const key of Object.keys(source)) {
    const sourceValue = source[key as keyof typeof source];
    const targetValue = result[key];

    if (sourceValue === undefined) continue;
    if (sourceValue === null) {
      result[key] = null;
      continue;
    }
    if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
      );
      continue;
    }
    result[key] = sourceValue;
  }

  return result as T;
}

/**
 * 深度克隆对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepClone) as unknown as T;

  const cloned: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    cloned[key] = deepClone((obj as Record<string, unknown>)[key]);
  }
  return cloned as T;
}
