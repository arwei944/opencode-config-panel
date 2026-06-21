/**
 * ============================================================
 * 适配器：FileSystemAdapter
 * 描述：将文件系统（fs）适配为 IFileSystemPort 接口
 * 依赖方向：适配器 → IFileSystemPort（实现方）
 * ============================================================
 */

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import yaml from 'js-yaml';
import type { IFileSystemPort, DirEntry } from '../../core/ports';

/** front-matter 分隔符 */
const FM_DELIMITER = '---';

/**
 * FileSystemAdapter
 * 适配文件系统操作 → IFileSystemPort
 */
export class FileSystemAdapter implements IFileSystemPort {
  /** 读取文件内容 */
  async readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8');
  }

  /** 写入文件内容 */
  async writeFile(filePath: string, content: string): Promise<void> {
    return fs.writeFile(filePath, content, 'utf-8');
  }

  /** 追加文件内容 */
  async appendFile(filePath: string, content: string): Promise<void> {
    return fs.appendFile(filePath, content, 'utf-8');
  }

  /** 删除文件 */
  async deleteFile(filePath: string): Promise<void> {
    return fs.unlink(filePath);
  }

  /** 检查文件或目录是否存在 */
  async exists(targetPath: string): Promise<boolean> {
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  /** 创建目录（递归） */
  async ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  /** 读取目录内容 */
  async readDir(dirPath: string): Promise<DirEntry[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map(entry => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
    }));
  }

  /** 递归删除目录 */
  async deleteDir(dirPath: string): Promise<void> {
    return fs.rm(dirPath, { recursive: true, force: true });
  }

  /** 获取文件统计信息 */
  async stat(filePath: string): Promise<{ size: number; mtime: Date }> {
    const stat = await fs.stat(filePath);
    return { size: stat.size, mtime: stat.mtime };
  }

  /** 解析 Markdown front-matter */
  parseMarkdown(raw: string): { frontmatter: Record<string, unknown>; content: string } {
    const trimmed = raw.trimStart();

    if (!trimmed.startsWith(FM_DELIMITER)) {
      return { frontmatter: {}, content: raw };
    }

    const endIndex = trimmed.indexOf(FM_DELIMITER, 3);
    if (endIndex === -1) {
      return { frontmatter: {}, content: raw };
    }

    const yamlBlock = trimmed.slice(3, endIndex).trim();
    const content = trimmed.slice(endIndex + 3).trimStart();

    try {
      const frontmatter = yaml.load(yamlBlock) as Record<string, unknown> || {};
      return { frontmatter, content };
    } catch {
      return { frontmatter: {}, content: raw };
    }
  }

  /** 序列化 Markdown front-matter */
  serializeMarkdown(frontmatter: Record<string, unknown>, content: string): string {
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
}
