import { ComponentRef, InjectionToken, Injector, Type, ViewContainerRef } from '@angular/core';
import { flatten, uniq } from 'lodash-es';
import { CommentComponent } from '../component/comment/comment.component';
import { EmbedPlaceholderComponent } from '../component/embed-placeholder/embed-placeholder.component';
import { LensComponent } from '../component/lens/lens.component';
import { NavComponent } from '../component/nav/nav.component';
import { RefComponent } from '../component/ref/ref.component';
import { ViewerComponent } from '../component/viewer/viewer.component';
import { Ext } from '../model/ext';
import { Page } from '../model/page';
import { Ref } from '../model/ref';
import { PipWindowConfig } from '../mods/system/pip';
import { ConfigService } from '../service/config.service';
import { handleMediaKeydown } from './keyboard';
import { hasTag } from './tag';

export const EMBED_NESTING = new InjectionToken<number>('embedNesting', {
  providedIn: 'root',
  factory: () => 0,
});

function createNestedComponent<T>(
  vc: ViewContainerRef,
  component: Type<T>,
  init: (c: ComponentRef<T>) => void,
): ComponentRef<T> | ComponentRef<EmbedPlaceholderComponent> {
  const nesting = vc.injector.get(EMBED_NESTING) + 1;
  const create = (container: ViewContainerRef) => {
    // Keep the actual depth after a click so descendants still require another click.
    const c = container.createComponent(component, {
      injector: Injector.create({
        parent: vc.injector,
        providers: [{ provide: EMBED_NESTING, useValue: nesting }],
      }),
    });
    init(c);
    return c;
  };
  if (nesting > vc.injector.get(ConfigService).maxEmbedNesting) {
    const placeholder = vc.createComponent(EmbedPlaceholderComponent);
    placeholder.instance.create = create;
    return placeholder;
  }
  return create(vc);
}

export function parseSrc(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const iframes = doc.documentElement.getElementsByTagName('iframe');
  return iframes.length > 0 ? iframes[0].src : '';
}

/**
 * Navigate an iframe without adding an entry to the browser history.
 * Setting iframe.src on an already loaded iframe pushes to the joint session history.
 */
export function setIframeSrc(iframe: HTMLIFrameElement, url: string) {
  if (url && iframe.isConnected && iframe.contentWindow) {
    try {
      iframe.contentWindow.location.replace(url);
      return;
    } catch (e) {
      // Fall back to src
    }
  }
  iframe.src = url;
}

export function createLink(vc: ViewContainerRef, url: string, text: string, title = '', css = ''): ComponentRef<NavComponent> {
  const c = vc.createComponent(NavComponent);
  c.setInput('url', url);
  c.setInput('text', text);
  c.setInput('title', title);
  c.setInput('css', css);
  return c;
}

export function createEmbed(vc: ViewContainerRef, ref: Ref, pip = false) {
  return createNestedComponent(vc, ViewerComponent, c => {
    if (hasTag('plugin/seamless', ref)) {
      ref.tags = uniq([...ref.tags || [], 'plugin/seamless']);
    }
    c.setInput('ref', ref);
    c.setInput('fullscreen', pip);
  });
}

export function createRef(vc: ViewContainerRef, ref: Ref, showToggle?: boolean) {
  if (hasTag('plugin/comment', ref)) {
    return createNestedComponent(vc, CommentComponent, c => {
      c.setInput('ref', ref);
      c.setInput('depth', 0);
    });
  } else {
    return createNestedComponent(vc, RefComponent, c => {
      c.setInput('ref', ref);
      c.setInput('showToggle', !!showToggle);
      c.setInput('expandInline', hasTag('plugin/thread', ref));
    });
  }
}

export function createLens(vc: ViewContainerRef, params: any, page: Page<Ref>, tag: string, ext?: Ext) {
  return createNestedComponent(vc, LensComponent, c => {
    c.setInput('page', page);
    c.setInput('pageControls', false);
    c.setInput('tag', tag);
    c.setInput('ext', ext);
    c.setInput('size', params.size);
    c.setInput('cols', params.cols);
    c.setInput('sort', flatten([params.sort || []]));
    c.setInput('filter', flatten([params.filter || []]));
    c.setInput('search', params.search);
  });
}

export async function createPip(vc: ViewContainerRef, ref: Ref, config: PipWindowConfig) {
  // @ts-ignore
  const pipWindow = await documentPictureInPicture.requestWindow(config);
  const pipStyle = `
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <style>
    html {
      overflow: hidden;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      & > .embed {
        display: contents;
        & > *:first-child {
          width: 100% !important;
          height: 100% !important;
          &.embed-container,
          &.embed-container > iframe {
            position: absolute;
            left: 0;
            top: 0;
            margin: 0 !important;
            width: 100% !important;
            height: 100% !important;
          }
          &.audio-expand {
            height: 54px !important;
          }
          &.code {
            display: contents;
            & > .md {
              display: contents;
              & > pre {
                max-width: unset !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: auto !important;
              }
            }
          }
        }
      }
    }
  </style>`;
  pipWindow.document.head.innerHTML = document.head.innerHTML + pipStyle;
  document.body.classList.forEach(c => pipWindow.document.body.classList.add(c));
  pipWindow.document.body.append(createEmbed(vc, ref, true).location.nativeElement);
  pipWindow.document.addEventListener('keydown', (event: KeyboardEvent) => {
    const video = pipWindow.document.querySelector('video');
    if (video) {
      handleMediaKeydown(event, video);
      return;
    }
    const audio = pipWindow.document.querySelector('audio');
    if (audio) handleMediaKeydown(event, audio);
  }, { capture: true });
}

export function embedUrl(url: string) {
  const embed = youtubeEmbedUrl(url);
  if (embed) return embed;
  return url.includes('https://www.youtube.com') ? url.replace('https://www.youtube.com', 'https://www.youtube-nocookie.com') : url;
}

/**
 * youtube-nocookie.com only serves /embed/ URLs, so convert watch, short and
 * playlist links into embed links.
 */
function youtubeEmbedUrl(url: string) {
  let u: URL;
  try {
    u = new URL(url);
  } catch (e) {
    return undefined;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return undefined;
  const host = u.hostname.toLowerCase();
  let id = '';
  if (host === 'youtu.be') {
    id = u.pathname.split('/')[1] || '';
  } else if (['www.youtube.com', 'youtube.com', 'm.youtube.com', 'music.youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com'].includes(host)) {
    const path = u.pathname.split('/');
    if (path[1] === 'watch') {
      id = u.searchParams.get('v') || '';
    } else if (['embed', 'shorts', 'live', 'v'].includes(path[1])) {
      id = path[2] || '';
    } else if (path[1] === 'playlist' && u.searchParams.has('list')) {
      id = 'videoseries';
    } else {
      return undefined;
    }
  } else {
    return undefined;
  }
  if (!id) return undefined;
  const params = new URLSearchParams();
  for (const [k, v] of u.searchParams) {
    if (k === 'v' || k === 'si' || k === 'feature') continue;
    if (k === 't' || k === 'start') {
      const start = parseYoutubeTime(v);
      if (start) params.set('start', '' + start);
      continue;
    }
    params.set(k, v);
  }
  const search = params.toString();
  return 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + (search ? '?' + search : '');
}

function parseYoutubeTime(t: string) {
  if (/^\d+s?$/.test(t)) return parseInt(t);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
  if (!m) return 0;
  return (parseInt(m[1] || '0') * 60 + parseInt(m[2] || '0')) * 60 + parseInt(m[3] || '0');
}
