/**
 * 技能管理服务
 * 扫描 skills/ 目录，管理 SKILL.md 文件的 CRUD 和权限
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { configService } from './configService';
import { parseFrontmatter, serializeFrontmatter } from './fileParser';
import { getSkillsDir, getSkillFilePath } from '../utils/paths';
import { AppError } from '../middleware/errorHandler';
import type { SkillInfo } from '../types';

class SkillService {
  // ============================================================
  // 7.1.1 scan() — 扫描 skills/ 目录
  // ============================================================
  async scan(): Promise<{ skills: SkillInfo[]; permissions: Record<string, string> }> {
    const skillsDir = getSkillsDir();
    const config = await configService.getConfig();
    const permissionConfig = config.permission?.skill;
    const skillsConfig = config.skills;

    const skills: SkillInfo[] = [];

    try {
      const entries = await fs.readdir(skillsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillName = entry.name;
        const skillFilePath = getSkillFilePath(skillName);

        try {
          const raw = await fs.readFile(skillFilePath, 'utf-8');
          const parsed = parseFrontmatter(raw);

          // 从 frontmatter 中解析元数据
          const frontmatter = parsed.frontmatter;

          const skill: SkillInfo = {
            name: skillName,
            description: (frontmatter.description as string) || '',
            license: frontmatter.license as string,
            compatibility: frontmatter.compatibility as string,
            severity: frontmatter.severity as 'mandatory' | 'optional',
            persistence: frontmatter.persistence as 'session' | 'infinite',
            content: parsed.content,
            filePath: skillFilePath,
            enabled: true, // 默认启用
          };

          skills.push(skill);
        } catch {
          // SKILL.md 不存在或无法读取时跳过
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

  // ============================================================
  // 7.1.2 create() — 创建技能
  // ============================================================
  async create(skill: Omit<SkillInfo, 'filePath' | 'enabled'>): Promise<SkillInfo> {
    const skillsDir = getSkillsDir();
    const skillDir = path.join(skillsDir, skill.name);
    const skillFilePath = getSkillFilePath(skill.name);

    // 检查是否已存在
    try {
      await fs.access(skillDir);
      throw new AppError(409, 'DUPLICATE_NAME', `技能 "${skill.name}" 已存在`);
    } catch (err) {
      if (err instanceof AppError) throw err;
      // 目录不存在，继续创建
    }

    // 创建目录
    await fs.mkdir(skillDir, { recursive: true });

    // 构建 frontmatter
    const frontmatter: Record<string, unknown> = {
      description: skill.description,
    };
    if (skill.license) frontmatter.license = skill.license;
    if (skill.compatibility) frontmatter.compatibility = skill.compatibility;
    if (skill.severity) frontmatter.severity = skill.severity;
    if (skill.persistence) frontmatter.persistence = skill.persistence;

    // 写入 SKILL.md
    const fileContent = serializeFrontmatter(frontmatter, skill.content);
    await fs.writeFile(skillFilePath, fileContent, 'utf-8');

    return {
      ...skill,
      filePath: skillFilePath,
      enabled: true,
    };
  }

  // ============================================================
  // 7.1.3 update() — 更新技能
  // ============================================================
  async update(
    name: string,
    updates: Partial<Omit<SkillInfo, 'name' | 'filePath' | 'enabled'>>,
  ): Promise<SkillInfo> {
    const skillFilePath = getSkillFilePath(name);

    // 检查文件是否存在
    try {
      await fs.access(skillFilePath);
    } catch {
      throw new AppError(404, 'FILE_NOT_FOUND', `技能 "${name}" 不存在`);
    }

    // 读取当前内容
    const raw = await fs.readFile(skillFilePath, 'utf-8');
    const parsed = parseFrontmatter(raw);

    // 合并 frontmatter
    const mergedFrontmatter = {
      ...parsed.frontmatter,
      ...(updates.description !== undefined ? { description: updates.description } : {}),
      ...(updates.license !== undefined ? { license: updates.license } : {}),
      ...(updates.compatibility !== undefined ? { compatibility: updates.compatibility } : {}),
      ...(updates.severity !== undefined ? { severity: updates.severity } : {}),
      ...(updates.persistence !== undefined ? { persistence: updates.persistence } : {}),
    };

    // 合并内容
    const mergedContent = updates.content !== undefined ? updates.content : parsed.content;

    // 写入文件
    const fileContent = serializeFrontmatter(mergedFrontmatter, mergedContent);
    await fs.writeFile(skillFilePath, fileContent, 'utf-8');

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

  // ============================================================
  // 7.1.4 delete() — 删除技能
  // ============================================================
  async delete(name: string): Promise<void> {
    const skillsDir = getSkillsDir();
    const skillDir = path.join(skillsDir, name);

    try {
      await fs.access(skillDir);
    } catch {
      throw new AppError(404, 'FILE_NOT_FOUND', `技能 "${name}" 不存在`);
    }

    // 递归删除目录
    await fs.rm(skillDir, { recursive: true, force: true });
  }

  // ============================================================
  // 7.1.5 setPermission() — 设置技能权限
  // ============================================================
  async setPermission(skillName: string, permission: string): Promise<void> {
    const config = await configService.getConfig();
    const currentPermission = config.permission || {};

    // 确保 skill 权限是对象格式
    const skillPermission = currentPermission.skill || {};
    if (typeof skillPermission === 'object' && !Array.isArray(skillPermission)) {
      (skillPermission as Record<string, string>)[skillName] = permission;
    }

    currentPermission.skill = skillPermission;
    await configService.updateConfig({ permission: currentPermission });
  }

  // ============================================================
  // 文件读写
  // ============================================================

  /** 读取技能 SKILL.md 文件 */
  async readFile(name: string): Promise<{ frontmatter: Record<string, unknown>; content: string }> {
    const filePath = getSkillFilePath(name);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      return parseFrontmatter(raw);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new AppError(404, 'FILE_NOT_FOUND', `技能文件 "${name}/SKILL.md" 不存在`);
      }
      throw new AppError(500, 'OPERATION_FAILED', `读取文件失败: ${(err as Error).message}`);
    }
  }

  /** 写入技能 SKILL.md 文件 */
  async writeFile(name: string, frontmatter: Record<string, unknown>, content: string): Promise<void> {
    const filePath = getSkillFilePath(name);
    const fileContent = serializeFrontmatter(frontmatter, content);
    try {
      await fs.writeFile(filePath, fileContent, 'utf-8');
    } catch (err) {
      throw new AppError(500, 'OPERATION_FAILED', `写入文件失败: ${(err as Error).message}`);
    }
  }
}

export const skillService = new SkillService();
