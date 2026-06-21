/**
 * ============================================================
 * 提供商管理路由（组合器模式）
 * 通过 createProvidersRouter() 工厂函数注入已组装的服务
 * ============================================================
 */

import { Router } from 'express';
import type { ProviderService } from '../../core/services';

/**
 * 创建提供商管理路由
 */
export function createProvidersRouter(providerService: ProviderService) {
  const router = Router();

  // ============================================================
  // 智能探测
  // ============================================================

  /** POST /api/providers/detect — 智能探测提供商 */
  router.post('/detect', async (req, res, next) => {
    try {
      const { baseURL, apiKey } = req.body;
      if (!baseURL) {
        return res.status(400).json({ success: false, error: '请提供 baseURL', code: 'VALIDATION_ERROR' });
      }
      const result = await providerService.detect(baseURL, apiKey);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/providers/smart-add — 智能添加 */
  router.post('/smart-add', async (req, res, next) => {
    try {
      const { baseURL, apiKey } = req.body;
      if (!baseURL) {
        return res.status(400).json({ success: false, error: '请提供 baseURL', code: 'VALIDATION_ERROR' });
      }
      const result = await providerService.smartAdd(baseURL, apiKey);
      res.status(201).json({
        success: true,
        data: result,
        message: `提供商 "${result.name}" 已自动创建，检测到 ${Object.keys(result.config.models || {}).length} 个模型`,
      });
    } catch (err) {
      next(err);
    }
  });

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
        return res.status(400).json({ success: false, error: '请提供 name 和 config', code: 'VALIDATION_ERROR' });
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

  /** PATCH /api/providers/:name — 部分更新 */
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
      if (options?.baseURL) {
        const result = await providerService.detect(options.baseURL, options.apiKey);
        res.json({ success: true, data: { ...result, modelsFetched: Object.keys(result.models).length } });
        return;
      }
      // 从已保存的配置中获取连接信息
      const provider = await providerService.get(req.params.name);
      if (!provider) {
        return res.status(404).json({ success: false, error: `提供商 "${req.params.name}" 不存在`, code: 'FILE_NOT_FOUND' });
      }
      const result = await providerService.detect(
        provider.options?.baseURL || '',
        provider.options?.apiKey,
      );
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
      const provider = await providerService.get(req.params.name);
      if (!provider) {
        return res.status(404).json({ success: false, error: `提供商 "${req.params.name}" 不存在`, code: 'FILE_NOT_FOUND' });
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
        return res.status(400).json({ success: false, error: '请提供 key 和 config', code: 'VALIDATION_ERROR' });
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

  return router;
}
