/**
 * ============================================================
 * Port：IConfigPort
 * 描述：配置持久化端口 — 定义配置读写的契约接口
 * 依赖方向：服务层 → 本端口（单向依赖）
 * 实现方：适配器层（FileSystem、远程 API 等）
 * ============================================================
 */

import type { OpenCodeConfig, ConfigSummary } from '../../shared/atoms';

/** 配置端口接口 */
export interface IConfigPort {
  /** 读取完整配置 */
  read(): Promise<OpenCodeConfig>;

  /** 写入完整配置 */
  write(config: OpenCodeConfig): Promise<void>;

  /** 获取配置文件统计信息 */
  getSummary(config: OpenCodeConfig): Promise<ConfigSummary>;

  /** 获取配置文件的原始大小和修改时间 */
  getFileStats(): Promise<{ size: number; lastModified: string }>;
}
