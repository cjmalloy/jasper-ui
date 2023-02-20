export const youtubeHosts = ['www.youtube.com', 'm.youtube.com'];
export const bitchuteHosts = ['www.bitchute.com'];
export const twitterHosts = ['twitter.com', 'm.twitter.com', 'mobile.twitter.com'];
export const imgurHosts = ['i.imgur.com'];

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

export function getScheme(url: string): string | null {
  const parsed = getUrl(url);
  if (!parsed) return null;
  return parsed.protocol;
}

export function getPath(url: string): string | null {
  const parsed = getUrl(url);
  if (!parsed) return null;
  return parsed.pathname;
}

export function getExtension(url: string): string | null {
  const parsed = getUrl(url);
  if (!parsed) return null;
  if (!parsed.pathname.includes('.')) return parsed.pathname;
  return parsed.pathname.substring(parsed.pathname.lastIndexOf('.'));
}
