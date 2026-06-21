/**
 * ============================================================
 * 原子：Permission
 * 描述：权限配置类型定义（最小不可变单元）
 * 约束：本原子不可修改，所有变更应通过 Port 接口进行
 * ============================================================
 */

/** 权限动作类型 */
export type PermissionAction = 'ask' | 'allow' | 'deny';

/** 权限配置原子 */
export interface PermissionConfig {
  read?: PermissionAction | Record<string, PermissionAction>;
  edit?: PermissionAction | Record<string, PermissionAction>;
  glob?: PermissionAction | Record<string, PermissionAction>;
  grep?: PermissionAction | Record<string, PermissionAction>;
  list?: PermissionAction | Record<string, PermissionAction>;
  bash?: PermissionAction | Record<string, PermissionAction>;
  task?: PermissionAction | Record<string, PermissionAction>;
  webfetch?: PermissionAction;
  websearch?: PermissionAction;
  doom_loop?: PermissionAction;
  external_directory?: PermissionAction | Record<string, PermissionAction>;
  lsp?: PermissionAction | Record<string, PermissionAction>;
  todowrite?: PermissionAction;
  question?: PermissionAction;
  skill?: PermissionAction | Record<string, PermissionAction>;
  [key: string]: PermissionAction | Record<string, PermissionAction> | undefined;
}
