/**
 * 404 页面
 * 路由未匹配时的友好提示页面
 */

import { useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-96">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-gray-200 dark:text-gray-700 mb-4">404</h1>
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
          页面未找到
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          您访问的页面不存在，可能已被移除或路径有误。
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="primary" onClick={() => navigate('/dashboard')}>
            返回首页
          </Button>
          <Button variant="outline" onClick={() => navigate(-1)}>
            返回上页
          </Button>
        </div>
      </div>
    </div>
  );
}
