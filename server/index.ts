import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { corsMiddleware } from './middleware/cors';
import { errorHandler } from './middleware/errorHandler';
import configRouter from './routes/config';
import providersRouter from './routes/providers';
import toolsRouter from './routes/tools';
import hooksRouter from './routes/hooks';
import agentsRouter from './routes/agents';
import skillsRouter from './routes/skills';
import mcpRouter from './routes/mcp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * opencode 配置面板 - 后端服务入口
 * Express 服务器，提供 REST API 接口
 */

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

// 路由挂载
app.use('/api/config', configRouter);
// 注意：备份路由已挂载在 configRouter 中 (/api/config/backup, /api/config/backups)
app.use('/api/providers', providersRouter);
app.use('/api/tools', toolsRouter);
app.use('/api/hooks', hooksRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/skills', skillsRouter);
app.use('/api/mcp', mcpRouter);

// SPA fallback（生产模式下非 API 请求返回 index.html）
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

// API 404 处理
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    code: 'NOT_FOUND',
  });
});

// 错误处理
app.use(errorHandler);

// 启动服务器
app.listen(PORT, HOST, () => {
  console.log(`✓ opencode 配置面板后端已启动`);
  console.log(`  API 地址: http://${HOST}:${PORT}/api`);
  console.log(`  健康检查: http://${HOST}:${PORT}/api/health`);
});

export default app;
