import { Ref } from '../model/ref';
import { isInlineSvg } from '../pipe/thumbnail.pipe';
import { getExtension } from './http';
import { hasTag } from './tag';

type ThumbnailKey = 'color' | 'emoji' | 'radius';
type MediaPlugin = 'plugin/audio' | 'plugin/image' | 'plugin/video';

export function hasThumbnail(
  thumbnailPluginEnabled: boolean,
  imagePluginEnabled: boolean,
  editing: boolean,
  editRef: Ref,
  ref: Ref,
  repostRef?: Ref,
) {
  if (!thumbnailPluginEnabled) return false;
  const refs = editing ? [editRef] : [ref, repostRef];
  if (refs.some(value => hasTag('plugin/thumbnail', value))) return true;
  return imagePluginEnabled && refs.some(value => hasTag('plugin/image', value));
}

export function thumbnailRefs(editing: boolean, editRef: Ref, ref: Ref, repostRef?: Ref) {
  return editing ? [{ ...editRef, origin: ref.origin }] : [repostRef, ref];
}

export function thumbnailPlugin(ref: Ref, repostRef?: Ref): Record<string, unknown> | undefined {
  const plugin = ref.plugins?.['plugin/thumbnail'] || repostRef?.plugins?.['plugin/thumbnail'];
  return plugin && typeof plugin === 'object' && !Array.isArray(plugin) ? plugin : undefined;
}

export function thumbnailString(
  ref: Ref,
  repostRef: Ref | undefined,
  key: 'url' | 'color' | 'emoji',
) {
  const value = thumbnailPlugin(ref, repostRef)?.[key];
  return typeof value === 'string' ? value : '';
}

export function thumbnailUrl(ref: Ref, repostRef: Ref | undefined, imagePluginEnabled: boolean) {
  const url = thumbnailString(ref, repostRef, 'url');
  if (!imagePluginEnabled) return isInlineSvg(url) ? url : '';
  return url || mediaPluginUrl(ref, repostRef, 'plugin/image') || mediaPluginUrl(ref, repostRef, 'plugin/video');
}

export function mediaPluginUrl(ref: Ref, repostRef: Ref | undefined, plugin: MediaPlugin) {
  const value = ref.plugins?.[plugin]?.url || repostRef?.plugins?.[plugin]?.url;
  return typeof value === 'string' ? value : '';
}

export function thumbnailValue(
  key: ThumbnailKey,
  editing: boolean,
  editRef: Ref,
  ref: Ref,
  repostRef?: Ref,
) {
  return (editing
    ? editRef.plugins?.['plugin/thumbnail']?.[key]
    : ref.plugins?.['plugin/thumbnail']?.[key]
      || repostRef?.plugins?.['plugin/thumbnail']?.[key])
    || (key === 'radius' ? 0 : '');
}

export function mediaUrl(
  plugin: MediaPlugin,
  pluginEnabled: boolean,
  currentRef: Ref | undefined,
  ref: Ref,
  fallbackUrl: string,
): string | false {
  return pluginEnabled
    && hasTag(plugin, currentRef)
    && (ref.plugins?.[plugin]?.url || fallbackUrl);
}

export function mediaFilename(url: string, title: string | undefined, defaultTitle: string) {
  const extension = getExtension(url) || '';
  const filename = title || defaultTitle;
  return filename + (extension && !filename.toLowerCase().endsWith(extension) ? extension : '');
}

type MediaAttachmentOptions = {
  file: boolean;
  audio: string | false;
  video: string | false;
  image: string | false;
  proxyAudio: boolean;
  proxyVideo: boolean;
  proxyImage: boolean;
  url: string;
  origin?: string;
  filename: string;
  audioFilename: string;
  videoFilename: string;
  imageFilename: string;
  fetch: (url: string, origin: string | undefined, filename: string) => string;
};

export function mediaAttachment(options: MediaAttachmentOptions) {
  if (options.file) {
    return options.fetch(options.url, options.origin, options.filename);
  }
  const media = [
    [options.audio, options.proxyAudio, options.audioFilename],
    [options.video, options.proxyVideo, options.videoFilename],
    [options.image, options.proxyImage, options.imageFilename],
  ] as const;
  for (const [url, proxy, filename] of media) {
    if (url && (url.startsWith('cache:') || proxy)) {
      return options.fetch(url, options.origin, filename);
    }
  }
  return '';
}
