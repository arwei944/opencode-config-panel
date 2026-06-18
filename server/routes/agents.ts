/**
 * 代理管理路由
 * 代理 CRUD 及 .md 文件读写 API
 */

import { Router } from 'express';
import { agentService } from '../services/agentService';
import { AppError } from '../middleware/errorHandler';

const router = Router();

/** GET /api/agents — 获取所有代理 */
router.get('/', async (_req, res, next) => {
  try {
    const agents = await agentService.list();
    res.json({ success: true, data: { agents } });
  } catch (err) {
    next(err);
  }
});

/** POST /api/agents — 创建代理 */
router.post('/', async (req, res, next) => {
  try {
    const { name, config, prompt } = req.body;
    if (!name || !config) {
      throw new AppError(400, 'VALIDATION_ERROR', '请提供 name 和 config');
    }
    const agent = await agentService.create(name, config, prompt);
    res.status(201).json({ success: true, data: { agent }, message: '代理已创建' });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/agents/:name — 更新代理 */
router.put('/:name', async (req, res, next) => {
  try {
    const { config, prompt, frontmatter } = req.body;
    const agent = await agentService.update(req.params.name, config || {}, prompt, frontmatter);
    res.json({ success: true, data: { agent }, message: '代理已更新' });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/agents/:name — 删除代理 */
router.delete('/:name', async (req, res, next) => {
  try {
    await agentService.delete(req.params.name);
    res.json({ success: true, message: '代理已删除' });
  } catch (err) {
    next(err);
  }
});

/** GET /api/files/agent/:name — 读取代理 .md 文件 */
router.get('/files/:name', async (req, res, next) => {
  try {
    const file = await agentService.readFile(req.params.name);
    res.json({ success: true, data: file });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/files/agent/:name — 写入代理 .md 文件 */
router.put('/files/:name', async (req, res, next) => {
  try {
    const { frontmatter, content } = req.body;
    if (!content) {
      throw new AppError(400, 'VALIDATION_ERROR', '请提供 content');
    }
    const file = await agentService.writeFile(req.params.name, frontmatter || {}, content);
    res.json({ success: true, data: file, message: '文件已保存' });
  } catch (err) {
    next(err);
  }
});

export default router;
