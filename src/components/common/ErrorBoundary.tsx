/**
 * 错误边界组件
 * 全局错误捕获，防止单个组件崩溃导致整个页面白屏
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './Button';

interface ErrorBoundaryProps {
  /** 子组件 */
  children: ReactNode;
  /** 降级 UI 自定义渲染 */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * 错误边界组件
 * 捕获子组件抛出的渲染错误并显示友好的降级 UI
 * @example
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] 捕获异常:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback(this.state.error!, this.handleReset);
        }
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-64 p-8">
          <div className="text-center max-w-md">
            <div className="text-4xl mb-4 text-red-400">!</div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
              页面渲染异常
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              发生了意外错误，请尝试重置或刷新页面。
            </p>
            {this.state.error && (
              <details className="mb-4 text-left">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                  错误详情
                </summary>
                <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs text-red-500 overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="flex items-center justify-center gap-3">
              <Button variant="primary" onClick={this.handleReset}>
                重试
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
              >
                刷新页面
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
