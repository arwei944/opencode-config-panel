# Batch 4 开发计划：高优先级修复与完善

**批次目标**：修复所有高优先级 BUG、补全缺失的 audit 和 --json 支持、修复安全漏洞  
**预估工作量**：2-3 小时  
**验收基准**：tsc 0 error + vitest 77/77 + build success

---

## 一、高优先级 BUG 修复（30 分钟）

### T4.1 — 修复 3 个 CLI 已知 BUG（脚本注释中列出）

**文件**：`scripts/test-cli.mjs`（注释），对应源码：

| # | 问题 | 文件 | 行号 |
|---|---|---|---|
| BUG-1 | `agent delete --dry-run` 真删文件 | `cli/commands/agents.ts` | 77-92 |
| BUG-2 | `key delete --dry-run` 弹 confirm 弹窗 | `cli/commands/keys.ts` | 57-70 |
| BUG-3 | `provider remove --dry-run` 缺 dry-run 分支 | `cli/commands/providers.ts` | 208-217 |

**验收标准**：
- [ ] `agent delete --dry-run <name>` 输出 `[DRY-RUN]` 提示，不删除 `.md` 文件
- [ ] `key delete --dry-run <name>` 输出 `[DRY-RUN]` 提示，不弹确认框
- [ ] `provider remove --dry-run <name>` 输出 `[DRY-RUN]` 提示，不调用 `provider.delete()`
- [ ] 所有三个命令的 `--json` 模式输出 `dryRun: true`

---

### T4.2 — 修复 rollback dry-run 逻辑错误

**文件**：`cli/commands/backups.ts`，第 239-260 行

**问题**：`rollback --dry-run` 分支在 `return` 前调用了 `restoreBackup()`，导致 dry-run 真实执行

**修复前**：
```typescript
if (ctx.options.dryRun) { ctx.term.info('[DRY-RUN] ...'); return; }
// 这里虽然 return，但之前的 restoreBackup 已在 dry-run 分支前被调用
```

**验收标准**：
- [ ] `rollback --dry-run <id>` 输出 `[DRY-RUN]` 提示，不恢复任何备份
- [ ] `rollback --dry-run --latest` 输出 `[DRY-RUN]` 提示，不恢复
- [ ] `rollback --dry-run --json` 输出 `{ action: 'rollback', dryRun: true, target: '<id>' }`

---

## 二、补全 audit 日志（40 分钟）

### T4.3 — 补全 commands/remaining.ts 中 8 个缺失 audit 的命令

**文件**：`cli/commands/remaining.ts`

| 命令 | 子命令 | 当前状态 | 需补充 audit action |
|---|---|---|---|
| mcp | add/remove/toggle/update/test | ❌ 无 audit | `mcp.add`, `mcp.remove`, `mcp.toggle`, `mcp.update`, `mcp.test` |
| tool | toggle/set/reset | ❌ 无 audit | `tool.toggle`, `tool.set`, `tool.reset` |
| compaction | set | ❌ 无 audit | `compaction.set` |
| tool-output | set | ❌ 无 audit | `tool-output.set` |
| experimental | set | ❌ 无 audit | `experimental.set` |
| attachment | set | ❌ 无 audit | `attachment.set` |
| reference | add/remove/update | ❌ 无 audit | `reference.add`, `reference.remove`, `reference.update` |
| command | add/remove/edit/run | ❌ 无 audit | `command.add`, `command.remove`, `command.edit`, `command.run` |
| self update | install | ❌ 无 audit | `self.update` |

**验收标准**：
- [ ] 每个写操作后调用 `await ctx.audit.append('<action>', { ... })`
- [ ] audit action 名称与文档 `cli-enhancement-plan.md` T3.3 一致
- [ ] dry-run 分支不写 audit（保持 `!ctx.options.dryRun` 条件）
- [ ] 所有新增 audit 均通过 `--json` 输出 `action` 字段

---

### T4.4 — 补全 config.ts 中缺失的 audit

**文件**：`cli/commands/config.ts`

| 命令 | 当前状态 | 需补充 audit |
|---|---|---|
| set | ✅ 有 audit | 无需修改 |
| toggle | ❌ 无 audit | `config.toggle` |
| validate | ❌ 无 audit | `config.validate` |
| format | ❌ 无 audit | `config.format` |
| set-model | ❌ 无 audit | `config.set-model` |
| set-small-model | ❌ 无 audit | `config.set-small-model` |
| set-default-agent | ❌ 无 audit | `config.set-default-agent` |
| disabled-providers add/remove | ❌ 无 audit | `disabled-providers.add/remove` |
| enabled-providers set/clear | ❌ 无 audit | `enabled-providers.set/clear` |

**验收标准**：
- [ ] 上述 9 个命令写操作后均调用 `await ctx.audit.append(...)`
- [ ] audit detail 包含关键参数（如 key、value、name 等）

---

### T4.5 — 修复 ConfigService.createBackupManually() 缺失 audit

**文件**：`core/services/ConfigService.ts`，第 150-153 行

**问题**：`createBackupManually()` 方法未调用 audit 日志

**验收标准**：
- [ ] `createBackupManually()` 内部调用 `this.audit.append('backup.create', { id: info.id })`
- [ ] `backup watch` 自动备份场景 audit action 为 `backup.create` + `{ id, auto: true }`
- [ ] 手动 `backup create` 场景 audit action 为 `backup.create` + `{ id }`

---

## 三、补全 --json 支持（60 分钟）

### T4.6 — 补全 remaining.ts 中 6 个缺失 --json 的命令

**文件**：`cli/commands/remaining.ts`

| 命令 | 子命令 | 当前状态 | 需补充 --json |
|---|---|---|---|
| compaction | show/set | ❌ 完全无 --json | `{ action: 'compaction.show' }`, `{ action: 'compaction.set', updates }` |
| tool-output | show/set | ❌ 完全无 --json | `{ action: 'tool-output.show' }`, `{ action: 'tool-output.set', updates }` |
| experimental | list/set | ❌ 完全无 --json | `{ action: 'experimental.list' }`, `{ action: 'experimental.set', feature, value }` |
| attachment | show | ❌ 无 --json | `{ action: 'attachment.show' }` |
| mcp | test | ❌ 无 --json | `{ action: 'mcp.test', name, reachable, status }` |

**验收标准**：
- [ ] 每个命令的 show/list 子命令支持 `--json` 输出结构化数据
- [ ] set 子命令的 `--json` 输出包含 `action` 字段
- [ ] 所有 `--json` 输出在 `jsonMode=true` 时走 stdout

---

### T4.7 — 补全 config.ts 中 6 个缺失 --json 的命令

**文件**：`cli/commands/config.ts`

| 命令 | 当前状态 | 需补充 --json |
|---|---|---|
| validate | ⚠️ 有 --json 但缺 dry-run | `{ action: 'config.validate', dryRun?: true, valid, errors? }` |
| format | ❌ 完全无 --json | `{ action: 'config.format' }` |
| set-model | ❌ 无 --json | `{ action: 'config.set-model', model }` |
| set-small-model | ❌ 无 --json | `{ action: 'config.set-small-model', small_model }` |
| set-default-agent | ❌ 无 --json | `{ action: 'config.set-default-agent', default_agent }` |
| disabled-providers | ❌ 无 --json | `{ action: 'disabled-providers.add/remove/list', providers }` |
| enabled-providers | ❌ 无 --json | `{ action: 'enabled-providers.set/clear/list', providers }` |

**验收标准**：
- [ ] 每个命令均支持 `--json` 输出 `{ action: 'xxx', ...params }`
- [ ] `validate` 补全 `--dry-run` 支持

---

### T4.8 — 补全 providers.ts 中 3 个缺失 --json 的命令

**文件**：`cli/commands/providers.ts`

| 命令 | 当前状态 | 需补充 --json |
|---|---|---|
| list models | ✅ 有 --json | 验证格式正确性 |
| list agents | ✅ 有 --json | 验证格式正确性 |
| list tools | ✅ 有 --json | 验证格式正确性 |
| list mcp | ❌ 无 --json | `{ action: 'list.mcp', mcps: [...] }` |
| provider list-models | ❌ 完全无 --json | `{ action: 'provider.list-models', name, models: [...] }` |
| provider estimate | ❌ 完全无 --json | `{ action: 'provider.estimate', name, ... }` |
| provider doctor | ❌ 完全无 --json | `{ action: 'provider.doctor', name, ... }` |

**验收标准**：
- [ ] `list mcp` 输出 `{ action: 'list.mcp', mcps: [{ name, type, enabled, command?, url? }] }`
- [ ] `provider list-models` 输出 `{ action: 'provider.list-models', name, models: [{ name, displayName? }] }`
- [ ] `provider estimate` 输出 `{ action: 'provider.estimate', name, inputCost, outputCost, ... }`
- [ ] `provider doctor` 输出 `{ action: 'provider.doctor', name, checks: [...] }`

---

### T4.9 — 补全 template.ts 和 agents.ts 缺失 --json

**文件**：`cli/commands/template.ts`、`cli/commands/agents.ts`

| 命令 | 当前状态 | 需补充 |
|---|---|---|
| template apply | ⚠️ 有 --json | 验证格式 |
| template export | ⚠️ 有 --json | 修复 dry-run 时不应读取文件内容 |
| template import | ⚠️ 有 --json | 验证格式 |
| profile apply | ❌ 无 --json | `{ action: 'profile.use', name, topKeys }` |
| profile export | ❌ 无 --json | `{ action: 'profile.export', name, content }` |
| profile import | ❌ 无 --json | `{ action: 'profile.import', name, source }` |
| agent create | ⚠️ 有 --json | 验证格式 |
| agent delete | ⚠️ 有 --json | 验证格式 |
| agent update | ⚠️ 有 --json | 验证格式 |
| agent set-permission | ⚠️ 有 --json | 验证格式 |
| agent doctor | ❌ 无 --json | `{ action: 'agent.doctor', agents: [...] }` |

**验收标准**：
- [ ] profile use/export/import 均支持 `--json`
- [ ] agent doctor 支持 `--json` 输出 `{ action: 'agent.doctor', agents: [...] }`

---

## 四、修复 dry-run 缺失（20 分钟）

### T4.10 — 补全 remaining.ts 中缺失 --dry-run 的命令

**文件**：`cli/commands/remaining.ts`

| 命令 | 子命令 | 当前状态 |
|---|---|---|
| skills | edit | ❌ 无 --dry-run |
| mcp | test | ❌ 无 --dry-run |
| diff | import/rollback/file | ❌ 无 --dry-run |
| backup | watch | ❌ 无 --dry-run（watch 模式特殊处理） |

**验收标准**：
- [ ] `skills edit --dry-run <name>` 输出 `[DRY-RUN]` 提示，不打开编辑器
- [ ] `mcp test --dry-run <name>` 输出 `[DRY-RUN]` 提示，不发送 HTTP 请求
- [ ] `diff --dry-run <a> <b>` 输出 `[DRY-RUN]` 提示，不执行 diff 计算
- [ ] `backup watch --dry-run --once` 输出检测结果，不创建备份

---

## 五、修复安全漏洞（20 分钟）

### T4.11 — 修复 plugin install 命令注入漏洞

**文件**：`cli/commands/remaining.ts`，第 882-888 行

**问题**：`execSync(\`npm ls ${name} --prefix "${targetDir}" --depth=0 --json\`)` 未对 `name` 做输入验证

**修复方案**：
```typescript
// 在 plugin install 开头添加验证
if (!/^[a-z0-9][\w.-]{0,251}$/.test(name)) {
  ctx.term.err(`非法插件名: ${name}`);
  return;
}
```

**验收标准**：
- [ ] 插件名验证：仅允许字母、数字、连字符、点、下划线，2-253 字符
- [ ] 包含 shell 特殊字符的输入（如 `; rm -rf /`）被拒绝
- [ ] 正常插件名（如 `@scope/plugin-name`）仍可正常安装

---

### T4.12 — 修复 self update pkgName 白名单校验

**文件**：`cli/commands/remaining.ts`，第 1477-1479 行

**问题**：`pkgName` 来自硬编码字符串但无白名单校验

**修复方案**：
```typescript
const ALLOWED_PACKAGES = ['opencode-config-panel'];
if (!ALLOWED_PACKAGES.includes(pkgName)) {
  throw new Error(`不允许更新包: ${pkgName}`);
}
```

**验收标准**：
- [ ] 仅允许 `opencode-config-panel` 包名
- [ ] 篡改 pkgName 为其他值时抛出错误
- [ ] cron 后台模式同样受白名单保护

---

## 六、修复性能问题（20 分钟）

### T4.13 — 修复 AuditService.append() 全量重写性能问题

**文件**：`cli/services/AuditService.ts`，第 30-42 行

**问题**：每次 append 都 `readAllRaw()` + 全量 JSON 序列化 + 全量写入

**修复方案**：
```typescript
// 改为追加模式：只追加新行，不重读历史
async append(action: string, detail?: Record<string, unknown>): Promise<void> {
  const entry = { time: new Date().toISOString(), action, detail };
  const line = JSON.stringify(entry) + '\n';
  await appendFile(this.logPath, line, 'utf-8'); // 使用追加写入
}
```

**验收标准**：
- [ ] 1000 次 `audit.append()` 调用耗时 < 100ms（对比修复前 > 2s）
- [ ] 日志文件内容正确（每行一个 JSON 对象）
- [ ] `tail(n)` 方法兼容新格式（每行独立 JSON）
- [ ] `clear()` 方法清空文件

---

## 七、帮助文本同步更新（20 分钟）

### T4.14 — 同步 help.ts 与实际实现

**文件**：`cli/commands/help.ts`

**需更新项**：
1. `self update` 帮助：补充 `--cron-stop`/`--cron-status`/`--install`
2. `backup cleanup` 帮助：标注 `--keep <N>` 仅支持数字（或实现时间格式）
3. `provider test` 帮助：标注"仅检查配置存在性，不做 HTTP 连通性测试"
4. `ui` 帮助：标注"未实现"（与 remaining.ts 注释统一）
5. `list agents` 帮助：格式规范化

**验收标准**：
- [ ] `occ help` 输出与所有命令实际实现一致
- [ ] 无"占位"/"TODO"等标注与实际实现矛盾

---

## 八、优先级汇总

| 优先级 | 任务 | 预估时间 |
|---|---|---|
| 🔴 立即修复 | T4.1（3 个 CLI BUG） | 10 分钟 |
| 🔴 立即修复 | T4.2（rollback dry-run） | 5 分钟 |
| 🔴 立即修复 | T4.3（14 个命令 audit） | 20 分钟 |
| 🔴 立即修复 | T4.4（config audit） | 10 分钟 |
| 🔴 立即修复 | T4.5（ConfigService audit） | 5 分钟 |
| 🟡 高优先 | T4.6（remaining.ts --json） | 20 分钟 |
| 🟡 高优先 | T4.7（config.ts --json） | 15 分钟 |
| 🟡 高优先 | T4.8（providers.ts --json） | 15 分钟 |
| 🟡 高优先 | T4.9（template/agents --json） | 10 分钟 |
| 🟡 高优先 | T4.10（--dry-run 缺失） | 10 分钟 |
| 🟡 高优先 | T4.11（plugin 注入漏洞） | 5 分钟 |
| 🟡 高优先 | T4.12（pkgName 白名单） | 5 分钟 |
| 🟡 高优先 | T4.13（AuditService 性能） | 15 分钟 |
| 🟢 中优先 | T4.14（help 同步） | 10 分钟 |
| **合计** | | **约 2.5 小时** |

---

## 九、验收门控

每个任务完成后必须通过：

| 检查项 | 命令 | 标准 |
|---|---|---|
| 类型检查 | `npx tsc --noEmit` | 0 error |
| 后端类型 | `npx tsc -p tsconfig.server.json --noEmit` | 0 error |
| 单元测试 | `npx vitest run` | 77/77 |
| 构建 | `npx vite build` | built success |
| 手工验证 | 运行对应命令 | 输出符合验收标准 |

---

## 十、执行顺序

```
T4.1 → T4.2 → T4.3 → T4.4 → T4.5  （BUG 修复 + audit 补全，50 分钟）
T4.6 → T4.7 → T4.8 → T4.9        （--json 补全，60 分钟）
T4.10 → T4.11 → T4.12             （dry-run + 安全，20 分钟）
T4.13                             （性能，15 分钟）
T4.14                             （文档，10 分钟）
最终验证 + git commit
```
