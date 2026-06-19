# opencode-config-panel

`opencode-config-panel` 是一个面向 **opencode** 的配置管理项目，包含可视化面板与命令行工具两部分。

项目提供以下能力：

- 通过可视化界面查看与编辑配置
- 通过 `occ` 命令行执行配置管理、备份、模板、profile、密钥等操作
- 通过自动化回归脚本验证命令行为与干跑逻辑

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
npm run dev
```

### 构建与检查

```bash
npm run build
npm run lint
```

## 命令行工具

命令行入口为 `occ`，可通过 npm 脚本或直接执行：

```bash
npm run occ -- status
npm run occ -- help
node scripts/occ.mjs status
```

## 回归测试

仓库提供了自动化回归脚本，用于验证 `occ` 的核心命令行为：

```bash
npm run test:cli
```

也可以直接运行：

```bash
node scripts/test-cli.mjs
```

这套测试会：

- 使用临时 HOME 目录隔离真实配置
- 覆盖 `template`、`profile`、`backup`、`key`、`agent`、`provider`、`json` 等命令
- 检查 `--dry-run`、`--json`、审计日志、退出码与帮助信息
- 验证 `backup watch --once` 能快速退出

## 常见命令

```bash
npm run occ -- status
npm run occ -- doctor
npm run occ -- backup list
npm run occ -- template list
npm run occ -- profile list
npm run occ -- key list
npm run occ -- help
```

## 目录说明

- `scripts/occ.mjs`：命令行入口
- `scripts/test-cli.mjs`：自动化回归测试脚本
- `server/`：本地服务端代码
- `src/`：前端面板代码

## 许可证

本仓库当前未显式声明许可证，如需分发或开源使用，请先确认项目约定。
