/**
 * ============================================================
 * 原子：Skill
 * 描述：技能配置的类型定义（最小不可变单元）
 * 约束：本原子不可修改，所有变更应通过 Port 接口进行
 * ============================================================
 */

/** 技能信息原子 */
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

/** 技能扫描结果原子 */
export interface SkillScanResult {
  skills: SkillInfo[];
  permissions: Record<string, string>;
}

/** Markdown 文件原子（含 front-matter） */
export interface MarkdownFile {
  frontmatter: Record<string, unknown>;
  content: string;
  filePath: string;
}
