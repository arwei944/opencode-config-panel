import type { Request, Response, NextFunction } from 'express';

/**
 * 应用错误类
 * 携带 HTTP 状态码和错误码，用于统一错误处理
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** 错误响应格式 */
interface ErrorResponse {
  success: false;
  error: string;
  code: string;
}

/**
 * 统一错误处理中间件
 * 将各种错误转换为统一的 API 响应格式
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error(`[错误] ${err.message}`, err.stack);

  if (err instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      error: err.message,
      code: err.code,
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // JSON 解析错误
  if (err instanceof SyntaxError && 'body' in err) {
    const response: ErrorResponse = {
      success: false,
      error: '请求体 JSON 格式错误',
      code: 'INVALID_JSON',
    };
    res.status(400).json(response);
    return;
  }

  // 未知错误
  const response: ErrorResponse = {
    success: false,
    error: '服务器内部错误',
    code: 'INTERNAL_ERROR',
  };
  res.status(500).json(response);
}
