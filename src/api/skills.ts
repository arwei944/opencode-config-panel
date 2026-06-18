/**
 * 技能 API 封装
 */

import { get, post, put, del } from './client';

/** 技能信息 */
export interface SkillInfo {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  severity?: 'mandatory' | 'optional';
  persistence?: 'session' | 'infinite';
  content: string;
  filePath: string;
  enabled: boolean;
}

/** 技能列表响应 */
interface SkillsListResponse {
  skills: SkillInfo[];
  permissions: Record<string, string>;
}

/** 技能详情响应 */
interface SkillResponse {
  skill: SkillInfo;
}

/** 文件内容响应 */
interface FileResponse {
  frontmatter: Record<string, unknown>;
  content: string;
}

/** 获取所有技能 */
export function fetchSkills(): Promise<SkillsListResponse> {
  return get<SkillsListResponse>('/skills');
}

/** 创建技能 */
export function createSkill(data: {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  severity?: string;
  persistence?: string;
  content: string;
}): Promise<SkillResponse> {
  return post<SkillResponse>('/skills', data);
}

/** 更新技能 */
export function updateSkill(
  name: string,
  data: Partial<Omit<SkillInfo, 'name' | 'filePath' | 'enabled'>>,
): Promise<SkillResponse> {
  return put<SkillResponse>(`/skills/${encodeURIComponent(name)}`, data);
}

/** 删除技能 */
export function deleteSkill(name: string): Promise<void> {
  return del<void>(`/skills/${encodeURIComponent(name)}`);
}

/** 设置技能权限 */
export function setSkillPermission(name: string, permission: string): Promise<void> {
  return put<void>(`/skills/${encodeURIComponent(name)}/permission`, { permission });
}

/** 重新扫描技能目录 */
export function rescanSkills(): Promise<SkillsListResponse> {
  return post<SkillsListResponse>('/skills/rescan');
}

/** 读取技能 SKILL.md 文件 */
export function readSkillFile(name: string): Promise<FileResponse> {
  return get<FileResponse>(`/skills/files/${encodeURIComponent(name)}`);
}

/** 写入技能 SKILL.md 文件 */
export function writeSkillFile(
  name: string,
  frontmatter: Record<string, unknown>,
  content: string,
): Promise<void> {
  return put<void>(`/skills/files/${encodeURIComponent(name)}`, { frontmatter, content });
}
