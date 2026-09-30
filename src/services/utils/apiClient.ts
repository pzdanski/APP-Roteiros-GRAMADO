export function getApiUrl(path: string): string {
  if (typeof window !== 'undefined') {
    return path;
  }
  const port = (typeof process !== 'undefined' && process.env?.PORT) ? process.env.PORT : 8080;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `http://127.0.0.1:${port}${cleanPath}`;
}
