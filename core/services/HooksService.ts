/**
 * ============================================================
 * 服务：HooksService
 * 描述：事件钩子管理核心服务 — 纯业务逻辑
 * 依赖：IConfigPort（配置读写）
 * 约束：仅通过 Port 接口与外部交互
 * ============================================================
 */

import type { IConfigPort } from '../ports';
import type { HookCommand, ExperimentalConfig } from '../../shared/atoms';

/** 钩子服务构造参数 */
export interface HooksServiceOptions {
  configPort: IConfigPort;
}

/**
 * HooksService — 事件钩子管理核心服务
 */
export class HooksService {
  private configPort: IConfigPort;

  constructor(options: HooksServiceOptions) {
    this.configPort = options.configPort;
  }

  /** 获取钩子配置 */
  async get(): Promise<ExperimentalConfig['hook']> {
    const config = await this.configPort.read();
    return config.experimental?.hook || {};
  }

  /** 全量替换钩子配置 */
  async replace(data: ExperimentalConfig['hook']): Promise<ExperimentalConfig['hook']> {
    const config = await this.configPort.read();
    const experimental = config.experimental || {};
    experimental.hook = data;
    await this.configPort.write({ ...config, experimental });
    return data;
  }

  /** 设置文件编辑钩子 */
  async setFileEdited(extensions: string, commands: HookCommand[]): Promise<Record<string, HookCommand[]>> {
    // 验证扩展名
    const extList = extensions.split(',').map(e => e.trim());
    for (const ext of extList) {
      if (!ext.startsWith('.') || ext.length < 2) {
        throw new Error(`扩展名格式不正确: "${ext}"`);
      }
    }

    // 验证命令
    for (const cmd of commands) {
      if (!cmd.command || cmd.command.length === 0) {
        throw new Error('命令不能为空');
      }
    }

    const config = await this.configPort.read();
    const experimental = config.experimental || {};
    const hook = experimental.hook || {};
    const fileEdited = hook.file_edited || {};

    fileEdited[extensions] = commands;
    hook.file_edited = fileEdited;
    experimental.hook = hook;
    await this.configPort.write({ ...config, experimental });

    return fileEdited;
  }

  /** 删除扩展名组的文件编辑钩子 */
  async deleteFileEdited(extensions: string): Promise<void> {
    const config = await this.configPort.read();
    const experimental = config.experimental || {};
    const hook = experimental.hook || {};
    const fileEdited = hook.file_edited || {};

    if (!fileEdited[extensions]) {
      throw new Error(`扩展名组 "${extensions}" 不存在`);
    }

    delete fileEdited[extensions];
    hook.file_edited = fileEdited;
    experimental.hook = hook;
    await this.configPort.write({ ...config, experimental });
  }

  /** 添加会话完成钩子命令 */
  async addSessionCompleted(command: HookCommand): Promise<HookCommand[]> {
    if (!command.command || command.command.length === 0) {
      throw new Error('命令不能为空');
    }

    const config = await this.configPort.read();
    const experimental = config.experimental || {};
    const hook = experimental.hook || {};
    const sessionCompleted = hook.session_completed || [];

    sessionCompleted.push(command);
    hook.session_completed = sessionCompleted;
    experimental.hook = hook;
    await this.configPort.write({ ...config, experimental });

    return sessionCompleted;
  }

  /** 删除指定索引的会话完成钩子命令 */
  async deleteSessionCompleted(index: number): Promise<HookCommand[]> {
    const config = await this.configPort.read();
    const experimental = config.experimental || {};
    const hook = experimental.hook || {};
    const sessionCompleted = hook.session_completed || [];

    if (index < 0 || index >= sessionCompleted.length) {
      throw new Error(`索引 ${index} 超出范围`);
    }

    sessionCompleted.splice(index, 1);
    hook.session_completed = sessionCompleted;
    experimental.hook = hook;
    await this.configPort.write({ ...config, experimental });

    return sessionCompleted;
  }
}
