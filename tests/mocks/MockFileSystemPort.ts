/**
 * Mock: IFileSystemPort
 * 用于单元测试的文件系统端口模拟实现
 */

import type { IFileSystemPort, DirEntry } from '../../core/ports';

export class MockFileSystemPort implements IFileSystemPort {
  private files: Map<string, string> = new Map();
  private dirs: Set<string> = new Set();

  constructor() {
    this.dirs.add('/');
  }

  setFile(path: string, content: string): void {
    this.files.set(path, content);
    const dir = path.split('/').slice(0, -1).join('/');
    this.dirs.add(dir || '/');
  }

  async readFile(filePath: string): Promise<string> {
    const content = this.files.get(filePath);
    if (content === undefined) throw new Error(`文件不存在: ${filePath}`);
    return content;
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    this.files.set(filePath, content);
    const dir = filePath.split('/').slice(0, -1).join('/');
    this.dirs.add(dir || '/');
  }

  async deleteFile(filePath: string): Promise<void> {
    if (!this.files.has(filePath)) throw new Error(`文件不存在: ${filePath}`);
    this.files.delete(filePath);
  }

  async exists(targetPath: string): Promise<boolean> {
    return this.files.has(targetPath) || this.dirs.has(targetPath);
  }

  async ensureDir(dirPath: string): Promise<void> {
    this.dirs.add(dirPath);
  }

  async readDir(dirPath: string): Promise<DirEntry[]> {
    const entries: DirEntry[] = [];
    const seen = new Set<string>();
    // 先处理目录（确保 isDirectory 优先）
    for (const d of this.dirs) {
      if (d.startsWith(dirPath + '/') && d !== dirPath) {
        const name = d.replace(dirPath + '/', '').split('/')[0];
        if (name && !seen.has(name)) {
          seen.add(name);
          entries.push({ name, isDirectory: true, isFile: false });
        }
      }
    }
    // 再处理文件（仅当该名称尚未被目录占用）
    for (const f of this.files.keys()) {
      if (f.startsWith(dirPath + '/') || (dirPath === '/' && !f.includes('/'))) {
        const name = f.replace(dirPath + '/', '').split('/')[0];
        if (name && !seen.has(name)) {
          seen.add(name);
          entries.push({ name, isDirectory: false, isFile: true });
        }
      }
    }
    return entries;
  }

  async deleteDir(dirPath: string): Promise<void> {
    this.dirs.delete(dirPath);
    for (const f of this.files.keys()) {
      if (f.startsWith(dirPath)) this.files.delete(f);
    }
  }

  parseMarkdown(raw: string): { frontmatter: Record<string, unknown>; content: string } {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { frontmatter: {}, content: raw };
    const frontmatter: Record<string, unknown> = {};
    for (const line of match[1].split('\n')) {
      const [k, ...v] = line.split(':');
      if (k) frontmatter[k.trim()] = v.join(':').trim();
    }
    return { frontmatter, content: match[2] };
  }

  serializeMarkdown(frontmatter: Record<string, unknown>, content: string): string {
    const fm = Object.entries(frontmatter).map(([k, v]) => `${k}: ${v}`).join('\n');
    return `---\n${fm}\n---\n\n${content}`;
  }

  async stat(filePath: string): Promise<{ size: number; mtime: Date }> {
    const content = this.files.get(filePath);
    if (content === undefined) throw new Error(`文件不存在: ${filePath}`);
    return { size: Buffer.byteLength(content), mtime: new Date() };
  }
}
