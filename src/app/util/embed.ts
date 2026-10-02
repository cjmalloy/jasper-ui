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
  return url.includes('https://www.youtube.com') ? url.replace('https://www.youtube.com', 'https://www.youtube-nocookie.com') : url;
}
