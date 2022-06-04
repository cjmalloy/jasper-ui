
export interface Oembed {
  version: string,
  type: string,
  url: string,
  title?: string,
  thumbnail_url?: string,
  thumbnail_width?: number,
  thumbnail_height?: number,
  author_name?: string,
  author_url?: string,
  html?: string,
  width?: number,
  height?: number,
  cache_age?: string,
  provider_name?: string,
  provider_url?: string,
}
