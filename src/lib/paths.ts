/** Resolve site-local paths for both root and subdirectory hosting. */
export function sitePath(path = ''): string {
  const base = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/`;
  return `${base}${path.replace(/^\//, '')}`;
}
