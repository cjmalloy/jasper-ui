
export function getUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch (e) {}
  return null;
}

export function getHost(url: string): string | null {
  const parsed = getUrl(url);
  if (!parsed) return null;
  return parsed.host;
}

export function getScheme(url: string) {
  const parsed = getUrl(url);
  if (!parsed) return undefined;
  return parsed.protocol;
}

export function getPath(url: string): string | null {
  if (url.startsWith('/')) {
    if (url.includes('#')) url = url.substring(0, url.indexOf('#'));
    if (url.includes('?')) url = url.substring(0, url.indexOf('?'));
    return url;
  }
  const parsed = getUrl(url);
  if (!parsed) return null;
  return parsed.pathname;
}

export function getQuery(url: string): string {
  const parsed = getUrl(url);
  if (!parsed) return '';
  return parsed.search;
}

export function getExtension(url: string): string | null {
  const parsed = getUrl(url);
  if (!parsed) return null;
  if (!parsed.pathname.includes('.')) return parsed.pathname;
  return parsed.pathname.substring(parsed.pathname.lastIndexOf('.'));
}
