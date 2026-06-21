/**
 * ============================================================
 * CLI 辅助工具函数
 * ============================================================
 */

/** 验证名称（小写字母、数字、连字符，2-32 字符） */
export function validateName(name: string): boolean {
  return /^[a-z0-9-]{2,32}$/.test(name);
}

/** 获取对象顶层键 */
export function topKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).sort();
}

/** 计算 JSON 字节大小 */
export function jsonByteSize(obj: unknown): number {
  return Buffer.byteLength(JSON.stringify(obj, null, 2));
}

/** 格式化列表项 */
export function formatList(items: string[], indent = 2): string {
  if (items.length === 0) return '(空)';
  return items.map(i => ' '.repeat(indent) + i).join('\n');
}

/** 解析标志参数（--key=value 或 --key value） */
export function parseFlags(
  args: string[],
  defs: Record<string, { type: 'string' | 'boolean' | 'number'; default?: string | boolean | number; alias?: string }>,
): { flags: Record<string, string | boolean | number | undefined>; provided: Set<string>; rest: string[] } {
  const flags: Record<string, string | boolean | number | undefined> = {};
  const provided = new Set<string>();
  const rest: string[] = [];

  // 构建别名映射
  const aliasToName: Record<string, string> = {};
  for (const [name, def] of Object.entries(defs)) {
    if (def.alias) aliasToName[def.alias] = name;
    if (def.default !== undefined) flags[name] = def.default;
  }

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const eqIdx = a.indexOf('=');
      let key: string, val: string | undefined;
      if (eqIdx >= 0) {
        key = a.slice(2, eqIdx);
        val = a.slice(eqIdx + 1);
      } else {
        key = a.slice(2);
        val = undefined;
      }
      const def = defs[key];
      if (!def) { rest.push(a); continue; }
      provided.add(key);
      if (def.type === 'boolean') {
        flags[key] = true;
      } else if (val !== undefined) {
        flags[key] = def.type === 'number' ? parseFloat(val) : val;
      } else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        i++;
        flags[key] = def.type === 'number' ? parseFloat(args[i]) : args[i];
      }
    } else {
      rest.push(a);
    }
  }
  return { flags, provided, rest };
}

/** 将值转为布尔 */
export function toBool(val: string): boolean | undefined {
  if (['true', '1', 'yes'].includes(val.toLowerCase())) return true;
  if (['false', '0', 'no'].includes(val.toLowerCase())) return false;
  return undefined;
}

/** 验证枚举值 */
export function validateEnum<T extends string>(val: string, allowed: readonly T[], name: string): T {
  if (!allowed.includes(val as T)) {
    throw new Error(`${name} 必须是 [${allowed.join('|')}] 之一，收到 "${val}"`);
  }
  return val as T;
}

/** 脱敏 API Key */
export function redactApiKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}

/** 格式化字节大小 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
