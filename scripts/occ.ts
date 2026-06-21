#!/usr/bin/env node

/**
 * occ — Opencode 配置管理 CLI 工具（Low-Entropy Core 重构版）
 * ============================================================
 * 入口：解析命令行参数，委托给 CLI 组合器
 * ============================================================
 */

import { runCLI } from '../cli/composer';

const args = process.argv.slice(2);

runCLI(args).catch(err => {
  console.error(`未捕获错误: ${err.message}`);
  process.exit(1);
});
