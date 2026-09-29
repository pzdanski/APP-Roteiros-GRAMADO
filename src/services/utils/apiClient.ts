export function getApiUrl(path: string): string {
  if (typeof window !== 'undefined') {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `http://127.0.0.1:3000${cleanPath}`;
}
