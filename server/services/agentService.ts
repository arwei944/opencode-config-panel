/**
 * 代理管理服务
 * 合并管理 opencode.json 中的代理配置和 agents/*.md 文件
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { configService } from './configService';
import { parseFrontmatter, serializeFrontmatter } from './fileParser';
import { getAgentsDir, getAgentFilePath } from '../utils/paths';
import { AppError } from '../middleware/errorHandler';
import type { AgentConfig, MarkdownFile } from '../types';

export interface AgentInfo {
  name: string;
  filePath: string;
  config: AgentConfig;
  fileFrontmatter: Record<string, unknown>;
  fileContent: string;
}

class AgentService {
  // ============================================================
  // 6.1.2 list() — 获取所有代理
  // ============================================================
  async list(): Promise<AgentInfo[]> {
    const config = await configService.getConfig();
    const configAgents = config.agent || {};
    const agentsDir = getAgentsDir();

    const result: AgentInfo[] = [];
    const seenNames = new Set<string>();

    // 1. 从 opencode.json 的 agent 字段中读取
    for (const [name, agentConfig] of Object.entries(configAgents)) {
      const filePath = getAgentFilePath(name);
      let fileFrontmatter: Record<string, unknown> = {};
      let fileContent = '';

      try {
        const raw = await fs.readFile(filePath, 'utf-8');
        const parsed = parseFrontmatter(raw);
        fileFrontmatter = parsed.frontmatter;
        fileContent = parsed.content;
      } catch {
        // .md 文件不存在时，使用空值
      }

      result.push({ name, filePath, config: agentConfig, fileFrontmatter, fileContent });
      seenNames.add(name);
    }

    // 2. 扫描 agents/ 目录中的 .md 文件，补充未注册的代理
    try {
      const entries = await fs.readdir(agentsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
        const name = entry.name.replace(/\.md$/, '');
        if (seenNames.has(name)) continue; // 已在 config 中

        const filePath = getAgentFilePath(name);
        try {
          const raw = await fs.readFile(filePath, 'utf-8');
          const parsed = parseFrontmatter(raw);
          // 从 frontmatter 中推断配置
          const agentConfig: AgentConfig = {};
          if (parsed.frontmatter.mode) agentConfig.mode = parsed.frontmatter.mode as 'primary' | 'subagent' | 'all';
          if (parsed.frontmatter.description) agentConfig.description = parsed.frontmatter.description as string;
          if (parsed.frontmatter.model) agentConfig.model = parsed.frontmatter.model as string;

          result.push({
            name,
            filePath,
            config: agentConfig,
            fileFrontmatter: parsed.frontmatter,
            fileContent: parsed.content,
          });
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

  // ============================================================
  // 6.1.3 create() — 创建代理
  // ============================================================
  async create(
    name: string,
    config: AgentConfig,
    prompt?: string,
  ): Promise<AgentInfo> {
    // 验证名称
    if (!/^[a-z0-9-]{2,32}$/.test(name)) {
      throw new AppError(400, 'VALIDATION_ERROR', '代理名称必须为小写字母、数字、连字符，2-32 字符');
    }

    const currentConfig = await configService.getConfig();
    const agents = currentConfig.agent || {};

    // 检查名称冲突
    if (agents[name]) {
      throw new AppError(409, 'DUPLICATE_NAME', `代理 "${name}" 已存在`);
    }

    // 创建 .md 文件
    const agentsDir = getAgentsDir();
    await fs.mkdir(agentsDir, { recursive: true });

    const frontmatter: Record<string, unknown> = {};
    if (config.description) frontmatter.description = config.description;
    if (config.mode) frontmatter.mode = config.mode;

    const fileContent = serializeFrontmatter(frontmatter, prompt || `# ${name}\n\n你的代理提示词...`);
    const filePath = getAgentFilePath(name);
    await fs.writeFile(filePath, fileContent, 'utf-8');

    // 更新 opencode.json
    agents[name] = config;
    await configService.updateConfig({ agent: agents });

    return {
      name,
      filePath,
      config,
      fileFrontmatter: frontmatter,
      fileContent: prompt || '',
    };
  }

  // ============================================================
  // 6.1.4 update() — 更新代理
  // ============================================================
  async update(
    name: string,
    config: Partial<AgentConfig>,
    prompt?: string,
    frontmatter?: Record<string, unknown>,
  ): Promise<AgentInfo> {
    const currentConfig = await configService.getConfig();
    const agents = currentConfig.agent || {};

    if (!agents[name]) {
      throw new AppError(404, 'FILE_NOT_FOUND', `代理 "${name}" 不存在`);
    }

    // 更新 opencode.json 中的配置
    const updatedConfig: AgentConfig = { ...agents[name], ...config };
    agents[name] = updatedConfig;
    await configService.updateConfig({ agent: agents });

    // 更新 .md 文件
    const filePath = getAgentFilePath(name);
    let fileContent = prompt;

    if (prompt !== undefined || frontmatter !== undefined) {
      // 获取当前文件内容
      let currentFrontmatter: Record<string, unknown> = {};
      let currentContent = '';

      try {
        const raw = await fs.readFile(filePath, 'utf-8');
        const parsed = parseFrontmatter(raw);
        currentFrontmatter = parsed.frontmatter;
        currentContent = parsed.content;
      } catch {
        // 文件不存在时使用空值
      }

      const mergedFrontmatter = frontmatter || currentFrontmatter;
      const mergedContent = prompt !== undefined ? prompt : currentContent;

      fileContent = serializeFrontmatter(mergedFrontmatter, mergedContent);
      await fs.writeFile(filePath, fileContent, 'utf-8');
    }

    // 重新读取文件获取最新内容
    let finalFrontmatter: Record<string, unknown> = {};
    let finalContent = '';
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = parseFrontmatter(raw);
      finalFrontmatter = parsed.frontmatter;
      finalContent = parsed.content;
    } catch {
      // 忽略
    }

    return {
      name,
      filePath,
      config: updatedConfig,
      fileFrontmatter: finalFrontmatter,
      fileContent: finalContent,
    };
  }

  // ============================================================
  // 6.1.5 delete() — 删除代理
  // ============================================================
  async delete(name: string): Promise<void> {
    const currentConfig = await configService.getConfig();
    const agents = currentConfig.agent || {};

    if (!agents[name]) {
      throw new AppError(404, 'FILE_NOT_FOUND', `代理 "${name}" 不存在`);
    }

    // 从 opencode.json 中移除
    delete agents[name];
    await configService.updateConfig({ agent: agents });

    // 删除 .md 文件
    const filePath = getAgentFilePath(name);
    try {
      await fs.unlink(filePath);
    } catch {
      // 文件不存在时忽略
    }
  }

  // ============================================================
  // 文件读写方法
  // ============================================================

  /** 读取代理 .md 文件内容 */
  async readFile(name: string): Promise<MarkdownFile> {
    const filePath = getAgentFilePath(name);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = parseFrontmatter(raw);
      return {
        frontmatter: parsed.frontmatter,
        content: parsed.content,
        filePath,
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new AppError(404, 'FILE_NOT_FOUND', `代理文件 "${name}.md" 不存在`);
      }
      throw new AppError(500, 'OPERATION_FAILED', `读取文件失败: ${(err as Error).message}`);
    }
  }

  /** 写入代理 .md 文件 */
  async writeFile(name: string, frontmatter: Record<string, unknown>, content: string): Promise<MarkdownFile> {
    const filePath = getAgentFilePath(name);
    const fileContent = serializeFrontmatter(frontmatter, content);
    try {
      await fs.writeFile(filePath, fileContent, 'utf-8');
      return { frontmatter, content, filePath };
    } catch (err) {
      throw new AppError(500, 'OPERATION_FAILED', `写入文件失败: ${(err as Error).message}`);
    }
  }
}

export const agentService = new AgentService();
