/**
 * MCP 服务器管理路由
 */

import { Router } from 'express';
import { mcpService } from '../services/mcpService';
import { AppError } from '../middleware/errorHandler';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const servers = await mcpService.list();
    res.json({ success: true, data: { servers } });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, config } = req.body;
    if (!name || !config) throw new AppError(400, 'VALIDATION_ERROR', '请提供 name 和 config');
    const server = await mcpService.add(name, config);
    res.status(201).json({ success: true, data: { server }, message: 'MCP 服务器已创建' });
  } catch (err) { next(err); }
});

router.put('/:name', async (req, res, next) => {
  try {
    const server = await mcpService.update(req.params.name, req.body);
    res.json({ success: true, data: { server }, message: 'MCP 服务器已更新' });
  } catch (err) { next(err); }
});

router.delete('/:name', async (req, res, next) => {
  try {
    await mcpService.delete(req.params.name);
    res.json({ success: true, message: 'MCP 服务器已删除' });
  } catch (err) { next(err); }
});

export default router;
