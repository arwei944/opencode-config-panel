/**
 * ============================================================
 * Port：IConnectionTestPort
 * 描述：连接测试端口 — 定义测试提供商连接能力的契约接口
 * 依赖方向：服务层 → 本端口（单向依赖）
 * 实现方：适配器层（fetch、mock 等）
 * ============================================================
 */

import type { TestConnectionParams, TestConnectionResult, DetectResult } from '../../shared/atoms';

/** 连接测试端口接口 */
export interface IConnectionTestPort {
  /** 测试连接可用性 */
  test(params: TestConnectionParams): Promise<TestConnectionResult>;

  /** 智能探测提供商（根据 URL + API Key 识别类型和模型） */
  detect(baseURL: string, apiKey?: string): Promise<DetectResult>;
}
