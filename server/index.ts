/**
 * ============================================================
 * 服务端入口（组合器组装点）
 *
 * 组合流程：
 *   适配器层（文件系统/fetch）→ 端口接口 → 核心服务 → Express 路由
 *
 * 约束：
 *   1. 单向依赖：路由 → 服务 → 端口 ← 适配器
 *   2. 所有组装在 composeServer() 中完成
 * ============================================================
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { corsMiddleware } from './middleware/cors';
import { errorHandler } from './middleware/errorHandler';
import { composeServer } from './composer';
import { createConfigRouter } from './routes/config';
import { createProvidersRouter } from './routes/providers';
import { createAgentsRouter } from './routes/agents';
import { createToolsRouter } from './routes/tools';
import { createSkillsRouter } from './routes/skills';
import { createMcpRouter } from './routes/mcp';
import { createHooksRouter } from './routes/hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// 1. 组合器 — 组装所有适配器和核心服务
// ============================================================
const composition = composeServer();
const {
  configService,
  providerService,
  agentService,
  toolService,
  skillService,
  mcpService,
  hooksService,
} = composition;

// ============================================================
// 2. Express 应用配置
// ============================================================
const app = express();
const PORT = 3456;
const HOST = '127.0.0.1';

// 全局中间件
app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// 生产模式：托管前端静态文件
const distPath = path.join(__dirname, '..', 'dist');
const hasDist = fs.existsSync(distPath);
if (hasDist) {
  app.use(express.static(distPath));
  console.log(`✓ 静态文件目录: ${distPath}`);
}

// ============================================================
// 3. 路由挂载 — 通过工厂函数注入已组装的服务
// ============================================================
app.use('/api/config', createConfigRouter(configService));
app.use('/api/providers', createProvidersRouter(providerService));
app.use('/api/agents', createAgentsRouter(agentService));
app.use('/api/tools', createToolsRouter(toolService, configService));
app.use('/api/skills', createSkillsRouter(skillService));
app.use('/api/mcp', createMcpRouter(mcpService));
app.use('/api/hooks', createHooksRouter(hooksService));

// ============================================================
// 4. SPA fallback（生产模式）
// ============================================================
if (hasDist) {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/.')) {
      return next();
    }
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    next();
  });
}

// ============================================================
// 5. 错误处理
// ============================================================
app.use((_req, res) => {
  res.status(404).json({ success: false, error: '接口不存在', code: 'NOT_FOUND' });
});
app.use(errorHandler);

// ============================================================
// 6. 启动服务器
// ============================================================
app.listen(PORT, HOST, () => {
  console.log(`✓ opencode 配置面板后端已启动`);
  console.log(`  API 地址: http://${HOST}:${PORT}/api`);
  console.log(`  健康检查: http://${HOST}:${PORT}/api/health`);
});

export default app;
