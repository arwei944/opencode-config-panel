/**
 * ============================================================
 * 技能管理路由（组合器模式）
 * 通过 createSkillsRouter() 工厂函数注入已组装的服务
 * ============================================================
 */

import { Router } from 'express';
import type { SkillService } from '../../core/services';

/**
 * 创建技能管理路由
 */
export function createSkillsRouter(skillService: SkillService) {
  const router = Router();

  /** GET /api/skills — 获取所有技能 */
  router.get('/', async (_req, res, next) => {
    try {
      const data = await skillService.scan();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/skills — 创建技能 */
  router.post('/', async (req, res, next) => {
    try {
      const { name, description, license, compatibility, severity, persistence, content } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, error: '请提供技能名称', code: 'VALIDATION_ERROR' });
      }
      const skill = await skillService.create({
        name,
        description: description || '',
        license,
        compatibility,
        severity,
        persistence,
        content: content || '',
      });
      res.status(201).json({ success: true, data: { skill }, message: '技能已创建' });
    } catch (err) {
      next(err);
    }
  });

  /** PUT /api/skills/:name — 更新技能 */
  router.put('/:name', async (req, res, next) => {
    try {
      const skill = await skillService.update(req.params.name, req.body);
      res.json({ success: true, data: { skill }, message: '技能已更新' });
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /api/skills/:name — 删除技能 */
  router.delete('/:name', async (req, res, next) => {
    try {
      await skillService.delete(req.params.name);
      res.json({ success: true, message: '技能已删除' });
    } catch (err) {
      next(err);
    }
  });

  /** PUT /api/skills/:name/permission — 设置技能权限 */
  router.put('/:name/permission', async (req, res, next) => {
    try {
      const { permission } = req.body;
      if (!permission) {
        return res.status(400).json({ success: false, error: '请提供 permission 值', code: 'VALIDATION_ERROR' });
      }
      await skillService.setPermission(req.params.name, permission);
      res.json({ success: true, message: '技能权限已更新' });
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/skills/rescan — 重新扫描技能目录 */
  router.post('/rescan', async (_req, res, next) => {
    try {
      const data = await skillService.scan();
      res.json({ success: true, data, message: '技能目录已重新扫描' });
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/skills/files/:name — 读取技能 SKILL.md 文件 */
  router.get('/files/:name', async (req, res, next) => {
    try {
      const file = await skillService.readFile(req.params.name);
      res.json({ success: true, data: file });
    } catch (err) {
      next(err);
    }
  });

  /** PUT /api/skills/files/:name — 写入技能 SKILL.md 文件 */
  router.put('/files/:name', async (req, res, next) => {
    try {
      const { frontmatter, content } = req.body;
      if (!content) {
        return res.status(400).json({ success: false, error: '请提供 content', code: 'VALIDATION_ERROR' });
      }
      await skillService.writeFile(req.params.name, frontmatter || {}, content);
      res.json({ success: true, message: '文件已保存' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
