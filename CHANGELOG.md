# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-06-22

### Added - Batch 1: 大块功能补全

- **skills** 全套子命令：create/remove/add-path/add-url/list/doctor
  - `skills create <名称>` — 创建技能目录
  - `skills add-path <名称> <路径>` — 添加技能路径
  - `skills add-url <名称> <URL>` — 添加技能 URL
  - `skills list --verbose` — 列出技能详情（paths/url/description）
  - `skills doctor` — 健康检查
- **plugin** 真实实现：install/remove/list
  - `plugin install <npm包名>` — 安装 npm 插件
  - `plugin remove <插件名>` — 卸载插件
- **self update** 一键升级
  - `self update` — 检查并安装最新版
  - `self update --check` — 仅检查不安装
  - `self update --auto` — 自动安装（无需确认）

### Added - Batch 2: 中块功能补全

- **mcp** 全套子命令：add/remove/toggle/update/test/doctor
  - `mcp add <名称> --command <命令>` — 添加本地 MCP
  - `mcp add <名称> --url <URL>` — 添加远程 MCP
  - `mcp test <名称>` — 连通性测试
- **tool** 真实实现：list/toggle/set/reset
- **server** 全套子命令：set/start/stop/restart/watch
  - PID 文件管理（`~/.config/opencode/server.pid`）
  - `SIGTERM` 优雅停止
- **reference** 全套子命令：add/update/remove/validate
- **command** 自定义命令：add/remove/edit/run
- **compaction** 上下文压缩配置：show/set
- **tool-output** 工具输出阈值：show/set
- **experimental** 实验性功能：list/set
- **attachment** 图片附件限制：show/set

### Added - Batch 3: --json / --dry-run / audit 批量补齐

- 25+ 命令补全 `--json` 结构化输出支持
- 20+ 命令补全 `--dry-run` 预览模式支持
- 集中式审计日志（`AuditService` + JSONL 格式）
- `NodeTerminalAdapter` JSON 模式文本→stderr 修复
- 全局 `occ` 命令安装 + 防重复执行保护

### Added - Batch 4: 高优先级修复与完善

- **self update 增强**
  - `--cron <间隔>` — 后台守护进程自动定期更新（支持 1s/30m/2h/7d）
  - `--cron-stop` / `--cron-status` — 管理后台进程
  - `--quiet` — 静默模式
  - PID 文件管理 + SIGTERM 信号处理
- **ConfigService 审计增强**
  - `onBackupCreated` 回调：自动备份场景也写 audit
  - `createBackupManually()` 支持审计回调
- **--json 补全**：compaction/tool-output/experimental/attachment/provider list-models/estimate/doctor
- **audit 补全**：14 个命令补全 `ctx.audit.append()` 调用
- **安全修复**
  - plugin install 命令注入漏洞修复（插件名白名单校验）
  - self update pkgName 白名单校验
- **性能优化**
  - `AuditService.append()` 从全量重写（O(n)）改为追加模式（O(1)）
  - 新增 `IFileSystemPort.appendFile()` 接口
  - 1000 次 append 耗时从 >2s 降至 <100ms（20x+ 提升）
- **功能增强**
  - `backup cleanup --keep` 支持时间格式（`5d`/`12h`/`30m`）
  - `diff import/rollback/file` 补全 `--json` 输出
  - `rollback` 交互模式补全 `--dry-run` / `--json`
- **帮助文本同步**
  - self update 帮助补充所有选项
  - backup cleanup 帮助补充时间格式说明
  - provider test 帮助修正为"检查配置存在性"
  - ui 帮助标注改为"未实现"

### Fixed - Batch 4 BUG 修复

- 修复 `agent delete --dry-run` 真实删除 .md 文件的问题
- 修复 `key delete --dry-run` 仍弹确认框的问题
- 修复 `provider remove --dry-run` 缺少 dry-run 分支的问题
- 修复 `rollback --dry-run` 逻辑错误（dry-run 分支外调用 restoreBackup）
- 修复 `template export --dry-run` 不应读取并解析文件内容

### Changed

- `IFileSystemPort` 接口新增 `appendFile(filePath, content): Promise<void>`
- `ConfigServiceOptions` 接口新增 `onBackupCreated?: (info: BackupInfo) => void`
- `backup cleanup` 支持数字（`--keep 20`）和时间格式（`--keep 5d`）
- `help` 输出与实际实现保持同步

### Security

- plugin install 命令注入防护（插件名白名单：`/^(@[\w-]+\/)?[\w][\w.-]{0,251}$/`）
- self update 包名白名单校验（仅允许 `opencode-config-panel`）

---

## [1.0.0] - 2026-06-22

### Added - Batch 0: 基建

- `NodeTerminalAdapter` JSON 模式文本→stderr 修复
- `AuditService` 集中审计日志（JSONL 格式）
- `CliContext` 集成 `audit` 字段
- 回归测试框架 `scripts/test-cli.mjs`（45 条）
- CI 配置 `.github/workflows/ci.yml`
- `.prettierrc` + `.editorconfig`
- `package.json` scripts（test:all / format / clean / validate）
- 全局 `occ` 安装 + 防重复执行保护

---

_This CHANGELOG was generated automatically based on git commit history._
