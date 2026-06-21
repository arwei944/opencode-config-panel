/**
 * ============================================================
 * Port：IFileSystemPort
 * 描述：文件系统端口 — 定义文件和目录操作的契约接口
 * 依赖方向：服务层 → 本端口（单向依赖）
 * 实现方：适配器层（fs、mock 等）
 * ============================================================
 */

import type { MarkdownFile } from '../../shared/atoms';

/** 目录条目信息 */
export interface DirEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

/** 文件系统端口接口 */
export interface IFileSystemPort {
  /** 读取文件内容（UTF-8） */
  readFile(filePath: string): Promise<string>;

  /** 写入文件内容（UTF-8） */
  writeFile(filePath: string, content: string): Promise<void>;

  /** 追加文件内容（UTF-8） */
  appendFile(filePath: string, content: string): Promise<void>;

  /** 删除文件 */
  deleteFile(filePath: string): Promise<void>;

  /** 检查文件或目录是否存在 */
  exists(targetPath: string): Promise<boolean>;

  /** 创建目录（递归） */
  ensureDir(dirPath: string): Promise<void>;

  /** 读取目录内容 */
  readDir(dirPath: string): Promise<DirEntry[]>;

  /** 递归删除目录 */
  deleteDir(dirPath: string): Promise<void>;

  /** 解析 Markdown front-matter（不含 filePath） */
  parseMarkdown(raw: string): { frontmatter: Record<string, unknown>; content: string };

  /** 序列化 Markdown front-matter */
  serializeMarkdown(frontmatter: Record<string, unknown>, content: string): string;

  /** 获取文件统计信息 */
  stat(filePath: string): Promise<{ size: number; mtime: Date }>;
}
