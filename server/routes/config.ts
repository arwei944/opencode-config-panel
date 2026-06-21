/**
 * ============================================================
 * 配置管理路由（组合器模式）
 * 通过 createConfigRouter() 工厂函数注入已组装的服务
 * 依赖方向：路由层 → 核心服务（单向依赖）
 * ============================================================
 */

import { Router } from 'express';
import type { ConfigService } from '../../core/services';

/**
 * 创建配置管理路由
 * @param configService 已组装的配置服务实例
 */
export function createConfigRouter(configService: ConfigService) {
  const router = Router();

  /** GET /api/config — 获取完整配置及摘要 */
  router.get('/', async (_req, res, next) => {
    try {
      const config = await configService.getConfig();
      const summary = await configService.getSummary();
      res.json({ success: true, data: { config, summary } });
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/config/summary — 获取配置摘要 */
  router.get('/summary', async (_req, res, next) => {
    try {
      const summary = await configService.getSummary();
      res.json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  });

  /** PUT /api/config — 全量替换配置 */
  router.put('/', async (req, res, next) => {
    try {
      const config = await configService.replaceConfig(req.body);
      res.json({ success: true, data: { config }, message: '配置已更新' });
    } catch (err) {
      next(err);
    }
  });

  /** PATCH /api/config — 部分合并更新 */
  router.patch('/', async (req, res, next) => {
    try {
      const config = await configService.updateConfig(req.body);
      res.json({ success: true, data: { config }, message: '配置已更新' });
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/config/validate — 验证配置 */
  router.post('/validate', async (req, res, next) => {
    try {
      const result = configService.validate(req.body.config || req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/config/export — 导出完整配置 */
  router.get('/export', async (_req, res, next) => {
    try {
      const exported = await configService.exportConfig();
      res.json({ success: true, data: exported });
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/config/import — 导入配置 */
  router.post('/import', async (req, res, next) => {
    try {
      const config = await configService.importConfig(req.body.config || req.body);
      res.json({ success: true, data: { config }, message: '配置已导入' });
    } catch (err) {
      next(err);
    }
  });

  // ============================================================
  // 备份管理
  // ============================================================

  /** POST /api/backup — 创建备份 */
  router.post('/backup', async (_req, res, next) => {
    try {
      const backup = await configService.createBackupManually();
      res.json({
        success: true,
        data: backup,
        message: '备份已创建',
      });
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/backups — 列出备份 */
  router.get('/backups', async (_req, res, next) => {
    try {
      const backups = await configService.listBackups();
      res.json({ success: true, data: { backups } });
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/config/backup/:id — 获取单个备份 */
  router.get('/backup/:id', async (req, res, next) => {
    try {
      const config = await configService.getBackup(req.params.id);
      res.json({ success: true, data: { config } });
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/config/backup/:id/restore — 恢复备份 */
  router.post('/backup/:id/restore', async (req, res, next) => {
    try {
      const config = await configService.restoreBackup(req.params.id);
      res.json({ success: true, data: { config }, message: '备份已恢复' });
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/backups/restore/:id — 恢复备份（兼容路径） */
  router.post('/backups/restore/:id', async (req, res, next) => {
    try {
      const config = await configService.restoreBackup(req.params.id);
      res.json({ success: true, data: { config }, message: '备份已恢复' });
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /api/config/backup/:id — 删除备份 */
  router.delete('/backup/:id', async (req, res, next) => {
    try {
      await configService.deleteBackup(req.params.id);
      res.json({ success: true, message: '备份已删除' });
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /api/backups/:id — 删除备份（兼容路径） */
  router.delete('/backups/:id', async (req, res, next) => {
    try {
      await configService.deleteBackup(req.params.id);
      res.json({ success: true, message: '备份已删除' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
