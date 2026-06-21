/**
 * ============================================================
 * 服务：SkillService
 * 描述：技能管理核心服务 — 纯业务逻辑
 * 依赖：IConfigPort（配置读写）、IFileSystemPort（文件操作）
 * 约束：仅通过 Port 接口与外部交互
 * ============================================================
 */

import type { IConfigPort, IFileSystemPort } from '../ports';
import type { SkillInfo, SkillScanResult, PermissionAction } from '../../shared/atoms';

/** 技能服务构造参数 */
export interface SkillServiceOptions {
  configPort: IConfigPort;
  fileSystemPort: IFileSystemPort;
  /** skills 目录路径（由适配器注入） */
  skillsDir: string;
  /** 获取技能文件路径的函数 */
  getSkillFilePath: (name: string) => string;
}

/**
 * SkillService — 技能管理核心服务
 */
export class SkillService {
  private configPort: IConfigPort;
  private fileSystemPort: IFileSystemPort;
  private skillsDir: string;
  private getSkillFilePath: (name: string) => string;

  constructor(options: SkillServiceOptions) {
    this.configPort = options.configPort;
    this.fileSystemPort = options.fileSystemPort;
    this.skillsDir = options.skillsDir;
    this.getSkillFilePath = options.getSkillFilePath;
  }

  /** 扫描 skills/ 目录 */
  async scan(): Promise<SkillScanResult> {
    const config = await this.configPort.read();
    const permissionConfig = config.permission?.skill;
    const skills: SkillInfo[] = [];

    try {
      const entries = await this.fileSystemPort.readDir(this.skillsDir);

      for (const entry of entries) {
        if (!entry.isDirectory) continue;

        const skillName = entry.name;
        const skillFilePath = this.getSkillFilePath(skillName);

        try {
          const raw = await this.fileSystemPort.readFile(skillFilePath);
          const parsed = this.fileSystemPort.parseMarkdown(raw);
          const frontmatter = parsed.frontmatter;

          skills.push({
            name: skillName,
            description: (frontmatter.description as string) || '',
            license: frontmatter.license as string,
            compatibility: frontmatter.compatibility as string,
            severity: frontmatter.severity as 'mandatory' | 'optional',
            persistence: frontmatter.persistence as 'session' | 'infinite',
            content: parsed.content,
            filePath: skillFilePath,
            enabled: true,
          });
        } catch {
          // SKILL.md 不存在时跳过
        }
      }
    } catch {
      // skills/ 目录不存在
    }

    // 解析技能权限
    const permissions: Record<string, string> = {};
    if (typeof permissionConfig === 'object' && permissionConfig) {
      for (const [key, value] of Object.entries(permissionConfig)) {
        if (typeof value === 'string') {
          permissions[key] = value;
        }
      }
    }

    return { skills, permissions };
  }

  /** 创建技能 */
  async create(skill: Omit<SkillInfo, 'filePath' | 'enabled'>): Promise<SkillInfo> {
    const skillDir = `${this.skillsDir}/${skill.name}`;
    const skillFilePath = this.getSkillFilePath(skill.name);

    // 检查是否已存在
    try {
      const exists = await this.fileSystemPort.exists(skillDir);
      if (exists) {
        throw new Error(`技能 "${skill.name}" 已存在`);
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('已存在')) throw err;
      // 其他错误（如目录不存在）继续创建
    }

    // 创建目录
    await this.fileSystemPort.ensureDir(skillDir);

    // 构建 frontmatter
    const frontmatter: Record<string, unknown> = { description: skill.description };
    if (skill.license) frontmatter.license = skill.license;
    if (skill.compatibility) frontmatter.compatibility = skill.compatibility;
    if (skill.severity) frontmatter.severity = skill.severity;
    if (skill.persistence) frontmatter.persistence = skill.persistence;

    // 写入 SKILL.md
    const fileContent = this.fileSystemPort.serializeMarkdown(frontmatter, skill.content);
    await this.fileSystemPort.writeFile(skillFilePath, fileContent);

    return { ...skill, filePath: skillFilePath, enabled: true };
  }

  /** 更新技能 */
  async update(name: string, updates: Partial<Omit<SkillInfo, 'name' | 'filePath' | 'enabled'>>): Promise<SkillInfo> {
    const skillFilePath = this.getSkillFilePath(name);

    const exists = await this.fileSystemPort.exists(skillFilePath);
    if (!exists) {
      throw new Error(`技能 "${name}" 不存在`);
    }

    // 读取当前内容
    const raw = await this.fileSystemPort.readFile(skillFilePath);
    const parsed = this.fileSystemPort.parseMarkdown(raw);

    // 合并 frontmatter
    const mergedFrontmatter = {
      ...parsed.frontmatter,
      ...(updates.description !== undefined ? { description: updates.description } : {}),
      ...(updates.license !== undefined ? { license: updates.license } : {}),
      ...(updates.compatibility !== undefined ? { compatibility: updates.compatibility } : {}),
      ...(updates.severity !== undefined ? { severity: updates.severity } : {}),
      ...(updates.persistence !== undefined ? { persistence: updates.persistence } : {}),
    };

    const mergedContent = updates.content !== undefined ? updates.content : parsed.content;
    const fileContent = this.fileSystemPort.serializeMarkdown(mergedFrontmatter, mergedContent);
    await this.fileSystemPort.writeFile(skillFilePath, fileContent);

    return {
      name,
      description: (mergedFrontmatter.description as string) || '',
      license: mergedFrontmatter.license as string,
      compatibility: mergedFrontmatter.compatibility as string,
      severity: mergedFrontmatter.severity as 'mandatory' | 'optional',
      persistence: mergedFrontmatter.persistence as 'session' | 'infinite',
      content: mergedContent,
      filePath: skillFilePath,
      enabled: true,
    };
  }

  /** 删除技能 */
  async delete(name: string): Promise<void> {
    const skillDir = `${this.skillsDir}/${name}`;
    const exists = await this.fileSystemPort.exists(skillDir);
    if (!exists) {
      throw new Error(`技能 "${name}" 不存在`);
    }
    await this.fileSystemPort.deleteDir(skillDir);
  }

  /** 设置技能权限 */
  async setPermission(skillName: string, permission: string): Promise<void> {
    const config = await this.configPort.read();
    const currentPermission = config.permission || {};

    const existingSkill = currentPermission.skill;
    const skillMap: Record<string, PermissionAction> = (typeof existingSkill === 'object' && existingSkill !== null && !Array.isArray(existingSkill))
      ? { ...(existingSkill as Record<string, PermissionAction>) }
      : {};
    skillMap[skillName] = permission as PermissionAction;
    currentPermission.skill = skillMap;
    await this.configPort.write({ ...config, permission: currentPermission });
  }

  /** 读取技能 SKILL.md 文件 */
  async readFile(name: string): Promise<{ frontmatter: Record<string, unknown>; content: string }> {
    const filePath = this.getSkillFilePath(name);
    const raw = await this.fileSystemPort.readFile(filePath);
    return this.fileSystemPort.parseMarkdown(raw);
  }

  /** 写入技能 SKILL.md 文件 */
  async writeFile(name: string, frontmatter: Record<string, unknown>, content: string): Promise<void> {
    const filePath = this.getSkillFilePath(name);
    const fileContent = this.fileSystemPort.serializeMarkdown(frontmatter, content);
    await this.fileSystemPort.writeFile(filePath, fileContent);
  }
}
