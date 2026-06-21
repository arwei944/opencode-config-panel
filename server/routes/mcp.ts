/**
 * ============================================================
 * MCP 服务器管理路由（组合器模式）
 * 通过 createMcpRouter() 工厂函数注入已组装的服务
 * ============================================================
 */

import { Router } from 'express';
import type { McpService } from '../../core/services';

/**
 * 创建 MCP 服务器管理路由
 */
export function createMcpRouter(mcpService: McpService) {
  const router = Router();

  /** GET /api/mcp — 获取所有 MCP 服务器 */
  router.get('/', async (_req, res, next) => {
    try {
      const servers = await mcpService.list();
      res.json({ success: true, data: { servers } });
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/mcp — 添加 MCP 服务器 */
  router.post('/', async (req, res, next) => {
    try {
      const { name, config } = req.body;
      if (!name || !config) {
        return res.status(400).json({ success: false, error: '请提供 name 和 config', code: 'VALIDATION_ERROR' });
      }
      const server = await mcpService.add(name, config);
      res.status(201).json({ success: true, data: { server }, message: 'MCP 服务器已创建' });
    } catch (err) {
      next(err);
    }
  });

  /** PUT /api/mcp/:name — 更新 MCP 服务器 */
  router.put('/:name', async (req, res, next) => {
    try {
      const server = await mcpService.update(req.params.name, req.body);
      res.json({ success: true, data: { server }, message: 'MCP 服务器已更新' });
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /api/mcp/:name — 删除 MCP 服务器 */
  router.delete('/:name', async (req, res, next) => {
    try {
      await mcpService.delete(req.params.name);
      res.json({ success: true, message: 'MCP 服务器已删除' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
