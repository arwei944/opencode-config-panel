/**
 * YAML Front-matter 解析服务
 * 解析和序列化 .md 文件的 YAML 头部
 */

import yaml from 'js-yaml';

/**
 * 解析后的 Markdown 文件结构
 */
export interface ParsedMarkdown {
  /** YAML front-matter 元数据 */
  frontmatter: Record<string, unknown>;
  /** 正文 Markdown 内容 */
  content: string;
}

/** front-matter 分隔符 */
const DELIMITER = '---';

/**
 * 解析 Markdown 文件的 front-matter
 * @param raw 原始文件内容
 * @returns 解析后的 frontmatter 和 content
 *
 * @example
 * parseFrontmatter('---\ndescription: "test"\n---\n# Content')
 * // => { frontmatter: { description: "test" }, content: "# Content" }
 */
export function parseFrontmatter(raw: string): ParsedMarkdown {
  const trimmed = raw.trimStart();

  // 检查是否以 --- 开头
  if (!trimmed.startsWith(DELIMITER)) {
    return { frontmatter: {}, content: raw };
  }

  // 找到第二个 ---
  const endIndex = trimmed.indexOf(DELIMITER, 3);
  if (endIndex === -1) {
    return { frontmatter: {}, content: raw };
  }

  const yamlBlock = trimmed.slice(3, endIndex).trim();
  const content = trimmed.slice(endIndex + 3).trimStart();

  try {
    const frontmatter = yaml.load(yamlBlock) as Record<string, unknown> || {};
    return { frontmatter, content };
  } catch {
    // YAML 解析失败时返回空 frontmatter
    return { frontmatter: {}, content: raw };
  }
}

/**
 * 将 frontmatter 和 content 序列化为 Markdown 文件
 * @param frontmatter 元数据对象
 * @param content 正文内容
 * @returns 完整的 Markdown 字符串
 */
export function serializeFrontmatter(
  frontmatter: Record<string, unknown>,
  content: string,
): string {
  // 过滤掉 undefined 值
  const cleanFrontmatter: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value !== undefined && value !== null) {
      cleanFrontmatter[key] = value;
    }
  }

  if (Object.keys(cleanFrontmatter).length === 0) {
    return content.trimStart();
  }

  const yamlStr = yaml.dump(cleanFrontmatter, {
    lineWidth: 120,
    noRefs: true,
    sortKeys: true,
  });

  return `---\n${yamlStr}---\n${content.trimStart()}`;
}
