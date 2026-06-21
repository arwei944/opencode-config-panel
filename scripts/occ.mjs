#!/usr/bin/env node

/**
 * occ — Opencode 配置管理 CLI 工具（引导入口）
 * ============================================================
 * 本文件是全局 `bin` 入口点。
 * 使用 tsx 的 tsImport 加载 TypeScript 版 CLI。
 * ============================================================
 */

import { tsImport } from 'tsx/esm/api';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// 设置引导标志，防止 occ.ts 重复执行
globalThis.__OCC_BOOTSTRAPPING = true;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(__dirname, 'occ.ts');
const entryUrl = pathToFileURL(entry).href;

try {
  // tsImport 加载 occ.ts，其顶级代码因 __OCC_BOOTSTRAPPING 标志跳过执行
  const mod = await tsImport(entryUrl, import.meta.url);
  const args = process.argv.slice(2);
  await mod.runCLI(args);
} catch (err) {
  console.error(`CLI 执行失败: ${err.message}`);
  process.exit(1);
}
