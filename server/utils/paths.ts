import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

/**
 * 路径工具模块
 * 提供 opencode 配置文件中所有路径的统一解析
 */

// 当前文件所在目录（兼容 ESM）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** 项目根目录 */
export const projectRoot = path.resolve(__dirname, '../..');

/** opencode 配置根目录 ~/.config/opencode/ */
export function getConfigDir(): string {
  return path.join(os.homedir(), '.config', 'opencode');
}

/** opencode.json 配置文件路径 */
export function getConfigPath(): string {
  return path.join(getConfigDir(), 'opencode.json');
}

/** agents/ 目录路径 */
export function getAgentsDir(): string {
  return path.join(getConfigDir(), 'agents');
}

/** skills/ 目录路径 */
export function getSkillsDir(): string {
  return path.join(getConfigDir(), 'skills');
}

/** backups/ 目录路径 */
export function getBackupsDir(): string {
  return path.join(getConfigDir(), 'backups');
}

/** 单个代理 .md 文件路径 */
export function getAgentFilePath(name: string): string {
  return path.join(getAgentsDir(), `${name}.md`);
}

/** 单个技能 SKILL.md 文件路径 */
export function getSkillFilePath(name: string): string {
  return path.join(getSkillsDir(), name, 'SKILL.md');
}

/** 备份目录路径（按时间戳） */
export function getBackupPath(timestamp: string): string {
  return path.join(getBackupsDir(), timestamp);
}
