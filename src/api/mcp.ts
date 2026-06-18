import { get, post, put, del } from './client';

export function fetchMcpServers(): Promise<{ servers: Record<string, unknown> }> {
  return get('/mcp');
}

export function createMcpServer(name: string, config: unknown): Promise<{ server: unknown }> {
  return post('/mcp', { name, config });
}

export function updateMcpServer(name: string, config: unknown): Promise<{ server: unknown }> {
  return put(`/mcp/${encodeURIComponent(name)}`, config);
}

export function deleteMcpServer(name: string): Promise<void> {
  return del(`/mcp/${encodeURIComponent(name)}`);
}
