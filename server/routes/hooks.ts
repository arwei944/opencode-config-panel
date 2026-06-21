/**
 * ============================================================
 * 事件钩子路由（组合器模式）
 * 通过 createHooksRouter() 工厂函数注入已组装的服务
 * ============================================================
 */

import { Router } from 'express';
import type { HooksService } from '../../core/services';

/**
 * 创建事件钩子管理路由
 */
export function createHooksRouter(hooksService: HooksService) {
  const router = Router();

  /** GET /api/hooks — 获取钩子配置 */
  router.get('/', async (_req, res, next) => {
    try {
      const hooks = await hooksService.get();
      res.json({ success: true, data: hooks });
    } catch (err) {
      next(err);
    }
  });

  /** PUT /api/hooks — 全量替换钩子配置 */
  router.put('/', async (req, res, next) => {
    try {
      const hooks = await hooksService.replace(req.body);
      res.json({ success: true, data: hooks, message: '钩子配置已更新' });
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/hooks/file-edited — 添加文件编辑钩子命令组 */
  router.post('/file-edited', async (req, res, next) => {
    try {
      const { extensions, commands } = req.body;
      const fileEdited = await hooksService.setFileEdited(extensions, commands);
      res.json({ success: true, data: { file_edited: fileEdited }, message: '文件编辑钩子已添加' });
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /api/hooks/file-edited/:extensions — 删除扩展名组 */
  router.delete('/file-edited/:extensions', async (req, res, next) => {
    try {
      await hooksService.deleteFileEdited(req.params.extensions);
      res.json({ success: true, message: '文件编辑钩子已删除' });
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/hooks/session-completed — 添加会话完成钩子命令 */
  router.post('/session-completed', async (req, res, next) => {
    try {
      const commands = await hooksService.addSessionCompleted(req.body);
      res.json({ success: true, data: { session_completed: commands }, message: '会话完成钩子已添加' });
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /api/hooks/session-completed/:index — 删除指定索引命令 */
  router.delete('/session-completed/:index', async (req, res, next) => {
    try {
      const index = parseInt(req.params.index, 10);
      const commands = await hooksService.deleteSessionCompleted(index);
      res.json({ success: true, data: { session_completed: commands }, message: '会话完成钩子已删除' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
