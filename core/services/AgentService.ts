/**
 * ============================================================
 * 服务：AgentService
 * 描述：代理管理核心服务 — 纯业务逻辑
 * 依赖：IConfigPort（配置读写）、IFileSystemPort（文件操作）
 * 约束：仅通过 Port 接口与外部交互
 * ============================================================
 */

import type { IConfigPort, IFileSystemPort } from '../ports';
import type { AgentConfig, AgentInfo, MarkdownFile } from '../../shared/atoms';

/** 代理服务构造参数 */
export interface AgentServiceOptions {
  configPort: IConfigPort;
  fileSystemPort: IFileSystemPort;
  /** agents 目录路径（由适配器注入） */
  agentsDir: string;
  /** 获取代理文件路径的函数 */
  getAgentFilePath: (name: string) => string;
}

/**
 * AgentService — 代理管理核心服务
 */
export class AgentService {
  private configPort: IConfigPort;
  private fileSystemPort: IFileSystemPort;
  private agentsDir: string;
  private getAgentFilePath: (name: string) => string;

  constructor(options: AgentServiceOptions) {
    this.configPort = options.configPort;
    this.fileSystemPort = options.fileSystemPort;
    this.agentsDir = options.agentsDir;
    this.getAgentFilePath = options.getAgentFilePath;
  }

  /** 获取所有代理（合并 opencode.json 配置 + agents/*.md 文件） */
  async list(): Promise<AgentInfo[]> {
    const config = await this.configPort.read();
    const configAgents = config.agent || {};
    const result: AgentInfo[] = [];
    const seenNames = new Set<string>();

    // 1. 从 opencode.json 的 agent 字段读取
    for (const [name, agentConfig] of Object.entries(configAgents)) {
      const filePath = this.getAgentFilePath(name);
      let fileFrontmatter: Record<string, unknown> = {};
      let fileContent = '';

      try {
        const raw = await this.fileSystemPort.readFile(filePath);
        const parsed = this.fileSystemPort.parseMarkdown(raw);
        fileFrontmatter = parsed.frontmatter;
        fileContent = parsed.content;
      } catch {
        // .md 文件不存在时使用空值
      }

      result.push({ name, filePath, config: agentConfig, fileFrontmatter, fileContent });
      seenNames.add(name);
    }

    // 2. 扫描 agents/ 目录补充未注册的代理
    try {
      const entries = await this.fileSystemPort.readDir(this.agentsDir);
      for (const entry of entries) {
        if (!entry.isFile || !entry.name.endsWith('.md')) continue;
        const name = entry.name.replace(/\.md$/, '');
        if (seenNames.has(name)) continue;

        const filePath = this.getAgentFilePath(name);
        try {
          const raw = await this.fileSystemPort.readFile(filePath);
          const parsed = this.fileSystemPort.parseMarkdown(raw);
          const agentConfig: AgentConfig = {};
          if (parsed.frontmatter.mode) agentConfig.mode = parsed.frontmatter.mode as 'primary' | 'subagent' | 'all';
          if (parsed.frontmatter.description) agentConfig.description = parsed.frontmatter.description as string;
          if (parsed.frontmatter.model) agentConfig.model = parsed.frontmatter.model as string;

          result.push({ name, filePath, config: agentConfig, fileFrontmatter: parsed.frontmatter, fileContent: parsed.content });
          seenNames.add(name);
        } catch {
          // 跳过无法读取的文件
        }
      }
    } catch {
      // agents/ 目录不存在
    }

    return result;
  }

  /** 创建代理 */
  async create(name: string, config: AgentConfig, prompt?: string): Promise<AgentInfo> {
    if (!/^[a-z0-9-]{2,32}$/.test(name)) {
      throw new Error('代理名称必须为小写字母、数字、连字符，2-32 字符');
    }

    const currentConfig = await this.configPort.read();
    const agents = currentConfig.agent || {};

    if (agents[name]) {
      throw new Error(`代理 "${name}" 已存在`);
    }

    // 创建 .md 文件
    await this.fileSystemPort.ensureDir(this.agentsDir);
    const frontmatter: Record<string, unknown> = {};
    if (config.description) frontmatter.description = config.description;
    if (config.mode) frontmatter.mode = config.mode;

    const fileContent = this.fileSystemPort.serializeMarkdown(frontmatter, prompt || `# ${name}\n\n你的代理提示词...`);
    const filePath = this.getAgentFilePath(name);
    await this.fileSystemPort.writeFile(filePath, fileContent);

    // 更新 opencode.json
    agents[name] = config;
    await this.configPort.write({ ...currentConfig, agent: agents });

    return { name, filePath, config, fileFrontmatter: frontmatter, fileContent: prompt || '' };
  }

  /** 更新代理 */
  async update(
    name: string,
    config: Partial<AgentConfig>,
    prompt?: string,
    frontmatter?: Record<string, unknown>,
  ): Promise<AgentInfo> {
    const currentConfig = await this.configPort.read();
    const agents = currentConfig.agent || {};

    if (!agents[name]) {
      throw new Error(`代理 "${name}" 不存在`);
    }

    // 更新 opencode.json 中的配置
    const updatedConfig: AgentConfig = { ...agents[name], ...config };
    agents[name] = updatedConfig;
    await this.configPort.write({ ...currentConfig, agent: agents });

    // 更新 .md 文件
    const filePath = this.getAgentFilePath(name);
    if (prompt !== undefined || frontmatter !== undefined) {
      let currentFrontmatter: Record<string, unknown> = {};
      let currentContent = '';

      try {
        const raw = await this.fileSystemPort.readFile(filePath);
        const parsed = this.fileSystemPort.parseMarkdown(raw);
        currentFrontmatter = parsed.frontmatter;
        currentContent = parsed.content;
      } catch {
        // 文件不存在时使用空值
      }

      const mergedFrontmatter = frontmatter || currentFrontmatter;
      const mergedContent = prompt !== undefined ? prompt : currentContent;
      const fileContent = this.fileSystemPort.serializeMarkdown(mergedFrontmatter, mergedContent);
      await this.fileSystemPort.writeFile(filePath, fileContent);
    }

    // 重新读取文件获取最新内容
    let finalFrontmatter: Record<string, unknown> = {};
    let finalContent = '';
    try {
      const raw = await this.fileSystemPort.readFile(filePath);
      const parsed = this.fileSystemPort.parseMarkdown(raw);
      finalFrontmatter = parsed.frontmatter;
      finalContent = parsed.content;
    } catch {
      // 忽略
    }

    return { name, filePath, config: updatedConfig, fileFrontmatter: finalFrontmatter, fileContent: finalContent };
  }

  /** 删除代理 */
  async delete(name: string): Promise<void> {
    const currentConfig = await this.configPort.read();
    const agents = currentConfig.agent || {};

    if (!agents[name]) {
      throw new Error(`代理 "${name}" 不存在`);
    }

    delete agents[name];
    await this.configPort.write({ ...currentConfig, agent: agents });

    const filePath = this.getAgentFilePath(name);
    try {
      await this.fileSystemPort.deleteFile(filePath);
    } catch {
      // 文件不存在时忽略
    }
  }

  /** 读取代理 .md 文件 */
  async readFile(name: string): Promise<MarkdownFile> {
    const filePath = this.getAgentFilePath(name);
    const raw = await this.fileSystemPort.readFile(filePath);
    return { ...this.fileSystemPort.parseMarkdown(raw), filePath };
  }

  /** 写入代理 .md 文件 */
  async writeFile(name: string, frontmatter: Record<string, unknown>, content: string): Promise<MarkdownFile> {
    const filePath = this.getAgentFilePath(name);
    const fileContent = this.fileSystemPort.serializeMarkdown(frontmatter, content);
    await this.fileSystemPort.writeFile(filePath, fileContent);
    return { frontmatter, content, filePath };
  }
}
