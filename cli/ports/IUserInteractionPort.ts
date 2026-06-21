/**
 * ============================================================
 * Port：IUserInteractionPort
 * 描述：用户交互端口 — 定义确认提示、输入读取的契约接口
 * 约束：仅定义契约，不包含实现
 * ============================================================
 */

/** 用户交互端口 */
export interface IUserInteractionPort {
  /** 确认提示（返回 true/false） */
  confirm(query: string): Promise<boolean>;
  /** 读取一行用户输入 */
  readLine(query: string): Promise<string>;
  /** 读取密码/敏感输入（不回显） */
  readPassword(query: string): Promise<string>;
}
