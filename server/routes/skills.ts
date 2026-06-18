/**
 * 技能管理路由
 * 技能 CRUD、扫描、权限设置及文件读写 API
 */

import { Router } from 'express';
import { skillService } from '../services/skillService';
import { AppError } from '../middleware/errorHandler';

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
      throw new AppError(400, 'VALIDATION_ERROR', '请提供技能名称');
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
      throw new AppError(400, 'VALIDATION_ERROR', '请提供 permission 值');
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

/** GET /api/files/skill/:name — 读取技能 SKILL.md 文件 */
router.get('/files/:name', async (req, res, next) => {
  try {
    const file = await skillService.readFile(req.params.name);
    res.json({ success: true, data: file });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/files/skill/:name — 写入技能 SKILL.md 文件 */
router.put('/files/:name', async (req, res, next) => {
  try {
    const { frontmatter, content } = req.body;
    if (!content) {
      throw new AppError(400, 'VALIDATION_ERROR', '请提供 content');
    }
    await skillService.writeFile(req.params.name, frontmatter || {}, content);
    res.json({ success: true, message: '文件已保存' });
  } catch (err) {
    next(err);
  }
});

export default router;
