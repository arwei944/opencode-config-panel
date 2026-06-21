/**
 * ============================================================
 * 代理管理路由（组合器模式）
 * 通过 createAgentsRouter() 工厂函数注入已组装的服务
 * ============================================================
 */

import { Router } from 'express';
import type { AgentService } from '../../core/services';

/**
 * 创建代理管理路由
 */
export function createAgentsRouter(agentService: AgentService) {
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
        return res.status(400).json({ success: false, error: '请提供 name 和 config', code: 'VALIDATION_ERROR' });
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

  /** GET /api/agents/files/:name — 读取代理 .md 文件 */
  router.get('/files/:name', async (req, res, next) => {
    try {
      const file = await agentService.readFile(req.params.name);
      res.json({ success: true, data: file });
    } catch (err) {
      next(err);
    }
  });

  /** PUT /api/agents/files/:name — 写入代理 .md 文件 */
  router.put('/files/:name', async (req, res, next) => {
    try {
      const { frontmatter, content } = req.body;
      if (!content) {
        return res.status(400).json({ success: false, error: '请提供 content', code: 'VALIDATION_ERROR' });
      }
      const file = await agentService.writeFile(req.params.name, frontmatter || {}, content);
      res.json({ success: true, data: file, message: '文件已保存' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
