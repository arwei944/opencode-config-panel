/**
 * ============================================================
 * 适配器：ConnectionTestAdapter
 * 描述：将 fetch API 适配为 IConnectionTestPort 接口
 * 依赖方向：适配器 → IConnectionTestPort（实现方）
 * ============================================================
 */

import type { IConnectionTestPort } from '../../core/ports';
import type {
  TestConnectionParams,
  TestConnectionResult,
  DetectResult,
  ModelConfig,
} from '../../shared/atoms';

// URL 域名 → 提供商类型 探测规则（适配器私有常量）
const URL_PROVIDER_TYPES: ReadonlyArray<{ pattern: RegExp; type: string; name: string }> = Object.freeze([
  Object.freeze({ pattern: /openai\.com/i, type: 'openai', name: 'openai' }),
  Object.freeze({ pattern: /anthropic\.com/i, type: 'anthropic', name: 'anthropic' }),
  Object.freeze({ pattern: /googleapis\.com/i, type: 'google', name: 'google' }),
  Object.freeze({ pattern: /deepseek\.com/i, type: 'openai', name: 'deepseek' }),
  Object.freeze({ pattern: /azure\.com/i, type: 'openai', name: 'azure' }),
  Object.freeze({ pattern: /github\.com/i, type: 'openai', name: 'github' }),
]);

// 已知模型列表（适配器默认数据）
const KNOWN_MODELS: Record<string, Record<string, ModelConfig>> = {
  opencode: {
    'big-pickle': { id: 'big-pickle', name: 'Big Pickle', context: 128000 } as ModelConfig,
    'deepseek-v4-flash-free': { id: 'deepseek-v4-flash-free', name: 'DeepSeek V4 Flash Free', context: 128000 } as ModelConfig,
    'mimo-v2.5-free': { id: 'mimo-v2.5-free', name: 'Mimo v2.5 Free', context: 128000 } as ModelConfig,
    'nemotron-3-ultra-free': { id: 'nemotron-3-ultra-free', name: 'Nemotron 3 Ultra Free', context: 128000 } as ModelConfig,
    'north-mini-code-free': { id: 'north-mini-code-free', name: 'North Mini Code Free', context: 128000 } as ModelConfig,
  },
};

/**
 * ConnectionTestAdapter
 * 适配 fetch → IConnectionTestPort
 */
export class ConnectionTestAdapter implements IConnectionTestPort {
  /** 测试连接可用性 */
  async test(params: TestConnectionParams): Promise<TestConnectionResult> {
    const { baseURL, apiKey, timeout = 10000 } = params;

    if (!baseURL) {
      throw new Error('请提供 baseURL');
    }

    let url: URL;
    try {
      url = new URL(baseURL);
    } catch {
      throw new Error('baseURL 格式不正确');
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      // 先尝试访问 /v1/models 端点（OpenAI 兼容）
      const modelsUrl = `${url.origin}/v1/models`;
      const response = await fetch(modelsUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        // 尝试访问根路径
        const rootResponse = await fetch(url.origin, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(timeout),
        });
        const rootLatency = Date.now() - startTime;

        return {
          reachable: rootResponse.ok,
          latencyMs: rootLatency,
          modelsFetched: 0,
          error: rootResponse.ok ? null : `服务返回 ${rootResponse.status}`,
        };
      }

      // 解析模型列表
      const body = await response.json();
      const models = body.data || body.models || [];
      const modelCount = Array.isArray(models) ? models.length : 0;

      return {
        reachable: true,
        latencyMs,
        modelsFetched: modelCount,
        error: null,
      };
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof DOMException && err.name === 'AbortError') {
        return {
          reachable: false,
          latencyMs: timeout,
          modelsFetched: 0,
          error: '连接超时',
        };
      }

      return {
        reachable: false,
        latencyMs: Date.now() - startTime,
        modelsFetched: 0,
        error: `连接失败: ${(err as Error).message}`,
      };
    }
  }

  /** 智能探测提供商 */
  async detect(baseURL: string, apiKey?: string): Promise<DetectResult> {
    const url = baseURL.replace(/\/+$/, '');
    let providerType = 'openai';
    let providerName = 'custom';

    // 1. 从 URL 探测提供商类型
    for (const rule of URL_PROVIDER_TYPES) {
      if (rule.pattern.test(url)) {
        providerType = rule.type;
        providerName = rule.name;
        break;
      }
    }

    // 2. 从域名自动生成名称
    if (providerName === 'custom') {
      try {
        const hostname = new URL(url).hostname;
        providerName = hostname.replace(/^www\./, '').split('.')[0].toLowerCase().replace(/[^a-z0-9-]/g, '');
      } catch {
        providerName = 'custom';
      }
    }

    // 3. 尝试拉取模型列表
    const models: Record<string, ModelConfig> = {};
    try {
      const response = await fetch(`${url}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey || ''}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = await response.json() as { data?: Array<{ id: string; name?: string; object?: string }> };
        const modelList = data.data || [];
        for (const m of modelList) {
          if (m.object === 'model' || !m.object) {
            const key = m.id.replace(`${providerName}/`, '').replace(`${providerType}/`, '');
            models[key] = { id: m.id, name: m.name || m.id };
          }
        }
      }
    } catch {
      // 拉取失败
    }

    // 4. 补充已知模型
    if (Object.keys(models).length === 0 && KNOWN_MODELS[providerName]) {
      Object.assign(models, KNOWN_MODELS[providerName]);
    }

    // 5. 占位模型
    if (Object.keys(models).length === 0) {
      models['default'] = { id: `${providerName}/default`, name: 'Default Model' };
    }

    return { name: providerName, type: providerType, models };
  }
}
