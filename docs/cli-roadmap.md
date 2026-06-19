# occ CLI 开发路线图

## 目标

将 `occ` 从配置读写工具升级为可验证、可回滚、可审计、可复用的配置治理系统。

## 开发原则

1. 所有配置任务必须先执行 `status`。
2. 变更优先使用 `occ` CLI，不直接改文件。
3. 每次变更后必须执行验证。
4. 失败时必须优先回滚。
5. 所有新增写操作默认支持 `--dry-run`。
6. 所有新增读取命令尽量支持 `--json`。

## 优先级划分

### P0：基础可靠性

#### 任务 1：统一全局参数解析
- 最小单元：支持 `--json`、`--yes`、`--dry-run`、`--quiet`、`--verbose`、`--no-color`
- 验收标准：任意顺序出现时都能正确生效

#### 任务 2：配置任务强制流程
- 最小单元：配置相关任务执行前先 `status`
- 最小单元：变更后执行验证
- 最小单元：失败后优先回滚
- 验收标准：文档与技能均强制要求该流程

#### 任务 3：健康检查
- 最小单元：`doctor` 命令
- 最小单元：provider / model / agent / skills / backups 检查
- 验收标准：可输出人类可读结果与 JSON 结果

#### 任务 4：差异对比
- 最小单元：`diff <a> <b>`
- 最小单元：`diff import <file>`
- 最小单元：`diff rollback <backup>`
- 验收标准：可以看到配置差异摘要

#### 任务 5：回滚与备份
- 最小单元：`rollback --latest`
- 最小单元：`rollback <file>`
- 最小单元：`backup cleanup`
- 最小单元：`backup diff`
- 最小单元：`backup watch`
- 验收标准：能恢复、能清理、能对比、能自动备份

#### 任务 6：provider 诊断
- 最小单元：`provider test`
- 最小单元：`provider estimate`
- 最小单元：`provider list-models`
- 验收标准：能检查连通性、能估算成本、能查看模型

#### 任务 7：技能生命周期
- 最小单元：`skills create`
- 最小单元：`skills show`
- 最小单元：`skills remove`
- 最小单元：`skills edit`
- 最小单元：`skills list`
- 验收标准：可以完整管理一个技能目录

### P1：对象生命周期管理

#### 任务 8：工具治理
- 最小单元：`tool toggle`
- 最小单元：`tool set`
- 最小单元：`list tools`
- 最小单元：`tool list --verbose`
- 最小单元：`tool reset`
- 验收标准：工具状态可查看、可切换、可恢复

#### 任务 9：密钥治理
- 最小单元：`key set`
- 最小单元：`key get`
- 最小单元：`key list`
- 最小单元：`key delete`
- 最小单元：`export --redact`
- 验收标准：密钥不需要明文散落在主配置里

#### 任务 10：模板与 profile
- 最小单元：`template save`
- 最小单元：`template apply`
- 最小单元：`template show`
- 最小单元：`template delete`
- 最小单元：`profile save`
- 最小单元：`profile use`
- 最小单元：`profile show`
- 最小单元：`profile delete`
- 验收标准：可保存、可切换、可复用多套配置

#### 任务 11：审计日志
- 最小单元：`log tail`
- 最小单元：`log clear`
- 最小单元：写入命令自动记录审计
- 验收标准：关键变更有记录

#### 任务 12：agent 治理增强
- 最小单元：`agent doctor`
- 最小单元：`agent create`
- 最小单元：`agent update`
- 最小单元：`agent delete`
- 验收标准：agent 能检查、创建、更新、删除

### P2：体验与自动化

#### 任务 13：自动修复
- 最小单元：`doctor --fix`
- 最小单元：`provider doctor --fix`
- 最小单元：`skills doctor --fix`
- 验收标准：可自动修复常见配置问题

#### 任务 14：交互式控制台
- 最小单元：提供菜单式选择
- 最小单元：支持回滚 / 备份 / provider / skills 快捷入口
- 验收标准：减少命令记忆成本

#### 任务 15：Web 控制台联动
- 最小单元：CLI 一键启动面板
- 最小单元：CLI 与前端共享操作结果
- 验收标准：命令行与界面协同

## 建议开发顺序

1. 全局参数解析
2. 强制配置流程
3. doctor / diff
4. 回滚与备份
5. provider 诊断
6. skills 生命周期
7. tool / key / template / profile
8. 审计日志
9. 自动修复
10. 交互式控制台与 Web 联动

## 当前已完成

- `skills create/remove/show/edit/list`
- `doctor`
- `diff`
- `provider test`
- `provider estimate`
- `rollback`
- `backup cleanup/diff/watch`
- `key`
- `template`
- `profile`
- `log`
- `json patch`
- `format`

## 下一步最小任务单元

1. `tool list --verbose`
2. `tool reset`
3. `skills doctor`
4. `provider doctor`
5. `doctor --fix`
6. `export/import` 的脱敏与批量验证
