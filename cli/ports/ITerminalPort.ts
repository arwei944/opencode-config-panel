/**
 * ============================================================
 * Port：ITerminalPort
 * 描述：终端 I/O 端口 — 定义命令行输出的契约接口
 * 约束：仅定义契约，不包含实现
 * ============================================================
 */

/** 终端输出端口 */
export interface ITerminalPort {
  /** 普通输出（受 --quiet 控制） */
  out(...args: unknown[]): void;
  /** 成功提示（彩色） */
  ok(msg: string): void;
  /** 信息提示 */
  info(msg: string): void;
  /** 警告提示 */
  warn(msg: string): void;
  /** 错误提示 */
  err(msg: string): void;
  /** JSON 输出（受 --json 控制） */
  jsonOut(data: unknown): void;
  /** 原始 console.log 绕过（不受 --quiet 影响） */
  raw(...args: unknown[]): void;
  /** 设置全局选项 */
  setOptions(opts: { json?: boolean; quiet?: boolean; color?: boolean }): void;
}
