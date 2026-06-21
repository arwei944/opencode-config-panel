/**
 * ============================================================
 * 工具管理路由（组合器模式）
 * 通过 createToolsRouter() 工厂函数注入已组装的服务
 * ============================================================
 */

import { Router } from 'express';
import type { ToolService, ConfigService } from '../../core/services';

/**
 * 创建工具管理路由
 */
export function createToolsRouter(toolService: ToolService, configService: ConfigService) {
  const router = Router();

  /** GET /api/tools — 获取所有工具及状态 */
  router.get('/', async (_req, res, next) => {
    try {
      const data = await toolService.list();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  });

  /** PUT /api/tools — 批量更新全局工具开关 */
  router.put('/', async (req, res, next) => {
    try {
      const tools = await toolService.updateGlobal(req.body.tools || {});
      res.json({ success: true, data: { tools }, message: '工具开关已更新' });
    } catch (err) {
      next(err);
    }
  });

  /** PUT /api/tools/agent/:agentName — 更新代理工具覆盖 */
  router.put('/agent/:agentName', async (req, res, next) => {
    try {
      const tools = await toolService.updateAgentOverrides(req.params.agentName, req.body.tools || {});
      res.json({ success: true, data: { tools }, message: '代理工具覆盖已更新' });
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/tools/agent/:agentName/reset — 重置代理工具覆盖 */
  router.post('/agent/:agentName/reset', async (req, res, next) => {
    try {
      await toolService.resetAgentOverrides(req.params.agentName);
      res.json({ success: true, message: '代理工具覆盖已重置' });
    } catch (err) {
      next(err);
    }
  });

  /** PUT /api/tools/primary — 更新主代理专属工具 */
  router.put('/primary', async (req, res, next) => {
    try {
      const primaryTools = await toolService.updatePrimaryTools(req.body.primaryTools || []);
      res.json({ success: true, data: { primaryTools }, message: '主代理专属工具已更新' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
