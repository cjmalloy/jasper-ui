export const youtubeHosts = ['www.youtube.com', 'm.youtube.com'];
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
