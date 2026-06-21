# CLI 功能增强开发文档

**版本**：v1.0  
**日期**：2026-06-22  
**状态**：待排期执行  
**总览**：3 个优先级批次，28 个任务单元，~117 项验收条目

---

## 一、批次总览

| 批次 | 优先级 | 主题 | 任务数 | 预估工作量 |
|---|---|---|---|---|
| **Batch 1** | 🔴 高 | 大块功能补全（skills / plugin / self update） | 9 | ~1 天 |
| **Batch 2** | 🟡 中 | 中块功能补全（mcp / tool / server / reference / command / attachment） | 10 | ~0.5 天 |
| **Batch 3** | 🟢 低 | --json / --dry-run / audit 批量补齐 + 小修复 | 9 | ~1 天 |

---

## 二、前置条件（所有批次共用）

### 编码规范
- 命令 handler 签名：`(args: string[], ctx: CliContext) => Promise<void>`
- `--json` 模式：文本输出走 stderr，仅 `ctx.term.jsonOut(data)` 写 stdout
- `--dry-run` 模式：不执行任何写操作（文件系统、配置、审计），仅输出预览
- audit：所有写操作调用 `await ctx.audit.append(action, detail)`
- 错误：调用 `ctx.term.err(msg)`，不使用 `throw`

### 测试入口
```
node scripts/test-cli.mjs      # CLI 回归测试（45 条）
npx vitest run                  # 单元 + 集成测试（77 条）
npx tsc --noEmit                # 前端类型检查
npx tsc -p tsconfig.server.json --noEmit  # 后端类型检查
npx vite build                  # Vite 生产构建
```

### 回归测试通过基准
- CLI 回归测试：**45/45**（当前基线）
- Vitest：**77/77**
- tsc：**0 error**
- build：**success**

---

## 三、Batch 1 — 大块功能补全

### T1.1 — `skills create`

**目标**：`occ skills create <名称> [--path <本地路径> | --url <git URL>]` 真实创建技能目录

**验收标准**
- [ ] `skills create <名称>`：在 `~/.config/opencode/skills/<名称>/SKILL.md` 创建最小骨架（含 frontmatter `name`, `description`）
- [ ] `--path <路径>`：将本地目录内容复制到 skills 目录
- [ ] `--url <URL>`：`git clone` 到临时目录再复制到 skills 目录
- [ ] `--dry-run`：不写盘，输出 `{ dryRun: true, name, action: 'skills.create', ... }` 到 stdout
- [ ] `--json`：输出 `{ action: 'skills.create', name, path: '...' }`
- [ ] audit：写 `skills.create`，含 `{ name, source: 'path|url|<none>' }`
- [ ] 名称合法性校验：`/^[a-z0-9-]{2,32}$/`，非法时报 `ctx.term.err('非法技能名: ...')`
- [ ] 已存在时报 `ctx.term.err('技能 "<名称>" 已存在')`

---

### T1.2 — `skills remove`

**目标**：`occ skills remove <名称> [--yes]` 真实删除技能目录

**验收标准**
- [ ] `skills remove <名称>`：删除 `~/.config/opencode/skills/<名称>` 目录（含 `SKILL.md`）
- [ ] `--yes`：跳过确认 prompt
- [ ] `--dry-run`：不删，输出 `[DRY-RUN] 将删除技能: <名称>`，stdout JSON 预览
- [ ] `--json`：输出 `{ action: 'skills.remove', name, existed: true/false }`
- [ ] audit：写 `skills.remove`，含 `{ name }`
- [ ] 不存在时：`ctx.term.err('技能 "<名称>" 不存在')`

---

### T1.3 — `skills edit`

**目标**：`occ skills edit <名称>` 用默认编辑器打开 `SKILL.md`

**验收标准**
- [ ] `skills edit <名称>`：调用 `EDITOR` 环境变量或 `vi` 打开 `SKILL.md`
- [ ] `--dry-run`：输出 `[DRY-RUN] 将打开编辑器: <名称>`，不执行
- [ ] audit：写 `skills.edit`，含 `{ name }`
- [ ] 不存在时报错

---

### T1.4 — `skills add-path` / `skills add-url`

**目标**：向已注册技能添加额外路径或 URL 元信息

**验收标准**
- [ ] `skills add-path <名称> <路径>`：在 `SKILL.md` frontmatter 中添加 `paths: ["<路径>"]`
- [ ] `skills add-url <名称> <URL>`：在 `SKILL.md` frontmatter 中添加 `url: "<URL>"`
- [ ] `--dry-run`：不写盘，JSON 预览
- [ ] `--json`：输出 `{ action, name, path/url }`
- [ ] audit：写 `skills.add-path` / `skills.add-url`

---

### T1.5 — `skills list --verbose`（补全）

**目标**：`skills list --verbose` 显示技能详细元信息

**验收标准**
- [ ] `--verbose` 模式：每个技能额外显示 `description`、`paths`、`url`、文件大小
- [ ] `--json`：输出 `{ action: 'skills.list', skills: [{ name, description, paths, url, size }] }`

---

### T1.6 — `skills doctor`（增强）

**目标**：`skills doctor` 完整性检查

**验收标准**
- [ ] 检查每个技能目录是否存在 `SKILL.md`
- [ ] 检查 frontmatter 中是否有 `name` 和 `description`
- [ ] 检查 `paths` 引用的路径是否存在
- [ ] 输出问题列表和 `skills.doctor` audit

---

### T1.7 — `plugin list`（真实实现）

**目标**：`plugin list` 真实读取已安装插件列表

**验收标准**
- [ ] 扫描 `~/.config/opencode/plugins/` 目录
- [ ] 列出每个插件的 `name`、`version`（从 `package.json` 读取）、`enabled`
- [ ] `--json`：输出 `{ action: 'plugin.list', plugins: [{ name, version, enabled }] }`

---

### T1.8 — `plugin install` / `plugin remove`

**目标**：`plugin install <npm包名> [--global] [--force]` 真实安装/卸载插件

**验收标准**
- [ ] `plugin install <名称>`：`npm install <名称> --prefix ~/.config/opencode/plugins/`
- [ ] `--global`：安装到 `~/.config/opencode/plugins/global/`
- [ ] `--force`：覆盖已有同名插件
- [ ] `--dry-run`：仅输出计划，不执行安装
- [ ] `--json`：输出 `{ action: 'plugin.install', name, version, global }`
- [ ] audit：写 `plugin.install` / `plugin.remove`
- [ ] `plugin remove <名称>`：删除插件目录

---

### T1.9 — `self update`

**目标**：`occ self update` 自更新到最新版本

**验收标准**
- [ ] 查询 npm registry 获取当前包最新版本
- [ ] 与本地版本比较，相同则输出"已是最新"
- [ ] 新版本时：`npm install -g opencode-config-panel@latest`
- [ ] `--dry-run`：仅报告版本差，不执行
- [ ] `--json`：输出 `{ action: 'self.update', current, latest, updated }`
- [ ] audit：写 `self.update`，含 `{ from, to }`

---

## 四、Batch 2 — 中块功能补全

### T2.1 — `mcp update` / `mcp test` / `mcp doctor`

**目标**：补全 MCP 子命令

**验收标准**
- [ ] `mcp update <名称> [--command | --url | --header]`：更新已存在 MCP 条目
- [ ] `mcp test <名称>`：真实 HTTP 请求（或进程 `--command` 进程检查），输出可达性
- [ ] `mcp doctor`：列出所有 MCP 条目及其状态（enabled/disabled、type、command/url）
- [ ] 每个子命令均有 `--dry-run` / `--json` / audit

---

### T2.2 — `tool list`（真实实现）

**目标**：替换静态占位文本

**验收标准**
- [ ] `tool list`：真实读取 `config.tools`，列出每个工具名 + 启用状态
- [ ] `--verbose`：显示更多元信息
- [ ] `--json`：输出 `{ action: 'tool.list', tools: [{ name, enabled }] }`

---

### T2.3 — `server watch` / `start` / `stop` / `restart`

**目标**：补全 server 进程控制

**验收标准**
- [ ] `server watch`：监听配置文件变化，变化时热重载配置
- [ ] `server start`：在后台启动 dev 服务器
- [ ] `server stop`：停止后台服务器（读取 PID 文件）
- [ ] `server restart`：stop → start
- [ ] 均有 `--dry-run` / `--json` / audit

---

### T2.4 — `reference update` / `reference validate`

**目标**：补全 reference 子命令

**验收标准**
- [ ] `reference update <名称> [--url | --path | --description | --branch]`：更新字段
- [ ] `reference validate <名称>`：检查 URL 是否可达（HEAD/GET），本地路径是否存在
- [ ] `--dry-run` / `--json` / audit

---

### T2.5 — `command edit` / `command run`

**目标**：补全 command 子命令

**验收标准**
- [ ] `command edit <名称>`：打开编辑器修改自定义命令模板
- [ ] `command run <名称> [args...]`：执行自定义命令模板（展开参数后调用系统 shell）
- [ ] `--dry-run` / `--json` / audit

---

### T2.6 — `attachment show`

**目标**：读取当前 attachment 限制

**验收标准**
- [ ] `attachment show`：读取并输出 `config.attachment` 内容
- [ ] `--json`：输出 `{ action: 'attachment.show', maxWidth, maxHeight, maxBytes }`
- [ ] `--dry-run` / audit

---

## 五、Batch 3 — 低优先级完善

### T3.1 — 高频命令 `--json` 批量补齐

**目标**：给 ~40 个高频命令添加 `--json` 输出

**范围与验收标准**

| 命令 | 子命令 | JSON 输出规范 |
|---|---|---|
| `status` | 全部 | 已实现 ✅ |
| `config.get` | 全部 | `{ action: 'config.get', key, value }` |
| `config.set` | 全部 | `{ action: 'config.set', key, value, dryRun }` |
| `config.toggle` | 全部 | `{ action: 'config.toggle', key, value }` |
| `config.validate` | 全部 | `{ action: 'config.validate', valid, errors }` |
| `config.format` | 全部 | `{ action: 'config.format', formatted: true }` |
| `list` | providers/models/agents/mcp/backups | `{ action: 'list.<type>', items: [...] }` |
| `provider` | update/list-models/test/estimate/doctor | `{ action: 'provider.<sub>', ... }` |
| `agent` | create/delete/update/set-permission/doctor | `{ action: 'agent.<sub>', ... }` |
| `backup` | create/list/restore/delete/cleanup/diff | `{ action: 'backup.<sub>', ... }` |
| `key` | get/export/import | `{ action: 'key.<sub>', ... }` |
| `template` | list/show/export/import | `{ action: 'template.<sub>', ... }` |
| `profile` | list/show/export/import | `{ action: 'profile.<sub>', ... }` |

**通用验收标准**
- [ ] stdout 为合法 JSON（`JSON.parse(stdout)` 不抛错）
- [ ] 文本输出（out/ok/info/warn/raw）走 stderr
- [ ] `err()` 走 stderr，与 JSON 互不污染

---

### T3.2 — `--dry-run` 批量补齐（读取类/诊断类）

**目标**：给 ~30 个读取类/诊断类命令添加 `--dry-run` 语义

**范围**
- `status`、`doctor`、`list` 全系列、`get`、`show` 全系列

**验收标准**
- [ ] 每个子命令有 `if (ctx.options.dryRun) { ctx.term.info('[DRY-RUN] ...'); return; }`
- [ ] dry-run 模式下不读任何写端口（configPort.write / backupPort.delete / fs.writeFile / audit.append）

---

### T3.3 — audit 日志批量补齐（所有写操作）

**目标**：给 ~50 个写操作添加 audit 日志

**已有 audit 的操作**（不复写）：template.save/delete/apply、profile.save/use/delete、backup.create、key.set/delete、agent.create/delete、provider.add/remove、config.set、json.set/patch

**待加 audit 的操作**

| 命令 | 子命令 | action 名称 |
|---|---|---|
| `skills` | create/remove/edit/add-path/add-url | `skills.create` / `skills.remove` 等 |
| `plugin` | install/remove | `plugin.install` / `plugin.remove` |
| `self` | update | `self.update` |
| `mcp` | add/remove/toggle | `mcp.add` / `mcp.remove` / `mcp.toggle` |
| `tool` | toggle/set/reset | `tool.toggle` / `tool.set` / `tool.reset` |
| `server` | set | `server.set` |
| `reference` | add/remove/update | `reference.add` / `reference.remove` / `reference.update` |
| `command` | add/remove/edit/run | `command.add` / `command.remove` 等 |
| `compaction` | set | `compaction.set` |
| `tool-output` | set | `tool-output.set` |
| `experimental` | set | `experimental.set` |
| `attachment` | set | `attachment.set` |
| `doctor` | --fix | `doctor.fix` |

**验收标准**
- [ ] `await ctx.audit.append(action, detail)` 在写操作成功后执行
- [ ] dry-run 分支不写 audit
- [ ] `log tail --json` 能返回新写入的记录

---

### T3.4 — `template apply` / `template export|import` 补齐 --json

**目标**：给 4 个子命令补 `--json` 输出

**验收标准**
- [ ] `template apply --json` → `{ action: 'template.apply', name }`
- [ ] `template export --json` → `{ action: 'template.export', name, path? }`
- [ ] `template import --json` → `{ action: 'template.import', name, source: '<路径>' }`
- [ ] `profile apply`（同 template 对应子命令）同理

---

### T3.5 — `doctor --json` 增强字段

**目标**：`doctor --json` 输出补全 backup 详细信息

**验收标准**
- [ ] 输出含 `summary.backupCount`、`summary.backupSize` 字段（当前已有）
- [ ] 输出 `warnings` 含备份数量过多时的具体条目

---

### T3.6 — `key export --json` / `key import --json`

**验收标准**
- [ ] `key export --json` → `{ action: 'key.export', keys: { <name>: <redacted> } }`
- [ ] `key import --json` → `{ action: 'key.import', imported: N }`

---

### T3.7 — `export --json` / `import --json`

**验收标准**
- [ ] `export --json` → `{ action: 'export', path, redacted: boolean }`
- [ ] `import --json` → `{ action: 'import', path, validatedOnly: boolean }`

---

### T3.8 — `rollback` 补齐 `--json` / `--dry-run` / audit

**验收标准**
- [ ] `rollback --dry-run <id>` → 输出计划，不执行
- [ ] `rollback --json <id>` → `{ action: 'rollback', target: '<id>', restored: true }`
- [ ] audit：`rollback.restore`，含 `{ target: '<id>' }`

---

### T3.9 — `help --json`

**验收标准**
- [ ] `help --json` → `{ action: 'help', commands: [{ name, aliases, description }] }`

---

## 六、验收门控矩阵

每个任务完成后，按顺序通过以下检查：

| 检查项 | 命令 | 通过标准 |
|---|---|---|
| ① CLI 回归测试（不影响现有） | `node scripts/test-cli.mjs` | 保持 **45/45**，不引入新 FAIL |
| ② Vitest 全量 | `npx vitest run` | **77/77** 全绿 |
| ③ 前端类型检查 | `npx tsc --noEmit` | **0 error** |
| ④ 后端类型检查 | `npx tsc -p tsconfig.server.json --noEmit` | **0 error** |
| ⑤ Vite 生产构建 | `npx vite build` | **built 成功** |
| ⑥ 新增功能手工验证 | 手动运行新增命令 | 见各任务验收标准 |

---

## 七、执行顺序

```
Batch 1（1 天）
  T1.1 → T1.2 → T1.3 → T1.4 → T1.5 → T1.6 → T1.7 → T1.8 → T1.9
  （完成后：回归测试 45/45 + 全量测试 + 构建）

Batch 2（0.5 天）
  T2.1 → T2.2 → T2.3 → T2.4 → T2.5 → T2.6
  （完成后：回归测试 45/45 + 全量测试 + 构建）

Batch 3（1 天）
  T3.1 → T3.2 → T3.3 → T3.4 → T3.5 → T3.6 → T3.7 → T3.8 → T3.9
  （完成后：回归测试 45/45 + 全量测试 + 构建）

所有批次完成后
  全局 npm install -g . 验证
  git commit（每个 batch 一次）
```

---

## 八、已落地的基建（Batch 0 已完成）

| 项目 | 状态 |
|---|---|
| `NodeTerminalAdapter` JSON 模式文本→stderr | ✅ |
| `AuditService` JSONL 集中审计 | ✅ |
| `CliContext` 集成 `audit` 字段 | ✅ |
| 回归测试框架 `scripts/test-cli.mjs` | ✅ |
| CI 配置 `.github/workflows/ci.yml` | ✅ |
| `.prettierrc` + `.editorconfig` | ✅ |
| `package.json` scripts（test:all / format / clean / validate） | ✅ |
| 全局 `occ` 安装 + 防重复执行修复 | ✅ |
