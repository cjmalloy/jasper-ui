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
  init: (instance: T) => void,
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
    init(c.instance);
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
  c.instance.url = url;
  c.instance.text = text;
  c.instance.title = title;
  c.instance.css = css;
  return c;
}

export function createEmbed(vc: ViewContainerRef, ref: Ref, pip = false) {
  return createNestedComponent(vc, ViewerComponent, instance => {
    if (hasTag('plugin/seamless', ref)) {
      ref.tags = uniq([...ref.tags || [], 'plugin/seamless']);
    }
    instance.ref = ref;
    instance.fullscreen = pip;
    instance.init();
  });
}

export function createRef(vc: ViewContainerRef, ref: Ref, showToggle?: boolean) {
  if (hasTag('plugin/comment', ref)) {
    return createNestedComponent(vc, CommentComponent, instance => {
      instance.ref = ref;
      instance.depth = 0;
      instance.init();
    });
  } else {
    return createNestedComponent(vc, RefComponent, instance => {
      instance.ref = ref;
      instance.showToggle = !!showToggle;
      instance.expandInline = hasTag('plugin/thread', ref);
      instance.init();
    });
  }
}

export function createLens(vc: ViewContainerRef, params: any, page: Page<Ref>, tag: string, ext?: Ext) {
  return createNestedComponent(vc, LensComponent, instance => {
    instance.page = page;
    instance.pageControls = false;
    instance.tag = tag;
    instance.ext = ext;
    instance.size = params.size;
    instance.cols = params.cols;
    instance.sort = flatten([params.sort || []]);
    instance.filter = flatten([params.filter || []]);
    instance.search = params.search;
    instance.init();
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
