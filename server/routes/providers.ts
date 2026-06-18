/**
 * 提供商管理路由
 * 提供商的 CRUD、模型管理及连接测试 API
 */

import { Router } from 'express';
import { providerService } from '../services/providerService';
import { testConnection } from '../services/testConnection';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// ============================================================
// 提供商 CRUD
// ============================================================

/** GET /api/providers — 获取所有提供商 */
router.get('/', async (_req, res, next) => {
  try {
    const providers = await providerService.list();
    res.json({ success: true, data: { providers } });
  } catch (err) {
    next(err);
  }
});

/** POST /api/providers — 添加提供商 */
router.post('/', async (req, res, next) => {
  try {
    const { name, config } = req.body;
    if (!name || !config) {
      throw new AppError(400, 'VALIDATION_ERROR', '请提供 name 和 config');
    }
    const provider = await providerService.add(name, config);
    res.status(201).json({ success: true, data: { provider }, message: '提供商已创建' });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/providers/:name — 更新提供商 */
router.put('/:name', async (req, res, next) => {
  try {
    const provider = await providerService.update(req.params.name, req.body);
    res.json({ success: true, data: { provider }, message: '提供商已更新' });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/providers/:name — 部分更新提供商 */
router.patch('/:name', async (req, res, next) => {
  try {
    const provider = await providerService.update(req.params.name, req.body);
    res.json({ success: true, data: { provider }, message: '提供商已更新' });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/providers/:name — 删除提供商 */
router.delete('/:name', async (req, res, next) => {
  try {
    await providerService.delete(req.params.name);
    res.json({ success: true, message: '提供商已删除' });
  } catch (err) {
    next(err);
  }
});

/** POST /api/providers/:name/test — 测试连接 */
router.post('/:name/test', async (req, res, next) => {
  try {
    const { options } = req.body;
    if (!options?.baseURL) {
      // 从已保存的配置中获取连接信息
      const providers = await providerService.list();
      const provider = providers[req.params.name];
      if (!provider) {
        throw new AppError(404, 'FILE_NOT_FOUND', `提供商 "${req.params.name}" 不存在`);
      }
      const result = await testConnection({
        baseURL: provider.options?.baseURL || '',
        apiKey: provider.options?.apiKey,
      });
      res.json({ success: true, data: result });
      return;
    }
    const result = await testConnection(options);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// 模型管理
// ============================================================

/** GET /api/providers/:name/models — 列出模型 */
router.get('/:name/models', async (req, res, next) => {
  try {
    const providers = await providerService.list();
    const provider = providers[req.params.name];
    if (!provider) {
      throw new AppError(404, 'FILE_NOT_FOUND', `提供商 "${req.params.name}" 不存在`);
    }
    res.json({ success: true, data: { models: provider.models || {} } });
  } catch (err) {
    next(err);
  }
});

/** POST /api/providers/:name/models — 添加模型 */
router.post('/:name/models', async (req, res, next) => {
  try {
    const { key, config } = req.body;
    if (!key || !config) {
      throw new AppError(400, 'VALIDATION_ERROR', '请提供 key 和 config');
    }
    const model = await providerService.addModel(req.params.name, key, config);
    res.status(201).json({ success: true, data: { model }, message: '模型已创建' });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/providers/:name/models — 批量更新模型 */
router.put('/:name/models', async (req, res, next) => {
  try {
    const models = await providerService.batchUpdateModels(req.params.name, req.body.models || {});
    res.json({ success: true, data: { models }, message: '模型已更新' });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/providers/:name/models/:key — 删除模型 */
router.delete('/:name/models/:key', async (req, res, next) => {
  try {
    await providerService.deleteModel(req.params.name, req.params.key);
    res.json({ success: true, message: '模型已删除' });
  } catch (err) {
    next(err);
  }
});

export default router;
