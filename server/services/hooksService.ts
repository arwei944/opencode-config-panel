/**
 * 事件钩子服务
 * 管理 experimental.hook 配置，包括文件编辑钩子和会话完成钩子
 */

import { configService } from './configService';
import type { HookCommand, ExperimentalConfig } from '../types';
import { AppError } from '../middleware/errorHandler';

class HooksService {
  // ============================================================
  // 5.1.1 get() — 获取钩子配置
  // ============================================================
  async get(): Promise<ExperimentalConfig['hook']> {
    const config = await configService.getConfig();
    return config.experimental?.hook || {};
  }

  // ============================================================
  // 5.1.2 setFileEdited() — 设置文件编辑钩子
  // ============================================================
  async setFileEdited(
    extensions: string,
    commands: HookCommand[],
  ): Promise<Record<string, HookCommand[]>> {
    const config = await configService.getConfig();
    const experimental = config.experimental || {};
    const hook = experimental.hook || {};
    const fileEdited = hook.file_edited || {};

    // 验证扩展名格式
    const extList = extensions.split(',').map(e => e.trim());
    for (const ext of extList) {
      if (!ext.startsWith('.') || ext.length < 2) {
        throw new AppError(400, 'VALIDATION_ERROR', `扩展名格式不正确: "${ext}"`);
      }
    }

    // 验证命令
    for (const cmd of commands) {
      if (!cmd.command || cmd.command.length === 0) {
        throw new AppError(400, 'VALIDATION_ERROR', '命令不能为空');
      }
    }

    fileEdited[extensions] = commands;
    hook.file_edited = fileEdited;
    experimental.hook = hook;

    await configService.updateConfig({ experimental });
    return fileEdited;
  }

  // ============================================================
  // 5.1.3 deleteFileEdited() — 删除扩展名组
  // ============================================================
  async deleteFileEdited(extensions: string): Promise<void> {
    const config = await configService.getConfig();
    const experimental = config.experimental || {};
    const hook = experimental.hook || {};
    const fileEdited = hook.file_edited || {};

    if (!fileEdited[extensions]) {
      throw new AppError(404, 'FILE_NOT_FOUND', `扩展名组 "${extensions}" 不存在`);
    }

    delete fileEdited[extensions];
    hook.file_edited = fileEdited;
    experimental.hook = hook;

    await configService.updateConfig({ experimental });
  }

  // ============================================================
  // 5.1.4 addSessionCompleted() — 添加会话完成钩子命令
  // ============================================================
  async addSessionCompleted(command: HookCommand): Promise<HookCommand[]> {
    const config = await configService.getConfig();
    const experimental = config.experimental || {};
    const hook = experimental.hook || {};
    const sessionCompleted = hook.session_completed || [];

    if (!command.command || command.command.length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', '命令不能为空');
    }

    sessionCompleted.push(command);
    hook.session_completed = sessionCompleted;
    experimental.hook = hook;

    await configService.updateConfig({ experimental });
    return sessionCompleted;
  }

  // ============================================================
  // 5.1.5 deleteSessionCompleted() — 删除指定索引命令
  // ============================================================
  async deleteSessionCompleted(index: number): Promise<HookCommand[]> {
    const config = await configService.getConfig();
    const experimental = config.experimental || {};
    const hook = experimental.hook || {};
    const sessionCompleted = hook.session_completed || [];

    if (index < 0 || index >= sessionCompleted.length) {
      throw new AppError(400, 'VALIDATION_ERROR', `索引 ${index} 超出范围`);
    }

    sessionCompleted.splice(index, 1);
    hook.session_completed = sessionCompleted;
    experimental.hook = hook;

    await configService.updateConfig({ experimental });
    return sessionCompleted;
  }

  // ============================================================
  // 全量替换钩子配置
  // ============================================================
  async replace(data: ExperimentalConfig['hook']): Promise<ExperimentalConfig['hook']> {
    const config = await configService.getConfig();
    const experimental = config.experimental || {};
    experimental.hook = data;
    await configService.updateConfig({ experimental });
    return data;
  }
}

export const hooksService = new HooksService();
