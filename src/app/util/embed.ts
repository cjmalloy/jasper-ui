import { ComponentRef, ViewContainerRef } from '@angular/core';
import { flatten, uniq } from 'lodash-es';
import { CommentComponent } from '../component/comment/comment.component';
import { LensComponent } from '../component/lens/lens.component';
import { NavComponent } from '../component/nav/nav.component';
import { RefComponent } from '../component/ref/ref.component';
import { ViewerComponent } from '../component/viewer/viewer.component';
import { Ext } from '../model/ext';
import { Page } from '../model/page';
import { Ref } from '../model/ref';
import { hasTag } from './tag';

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

export function createEmbed(vc: ViewContainerRef, ref: Ref, pip = false): ComponentRef<ViewerComponent> {
  const c = vc.createComponent(ViewerComponent);
  if (hasTag('plugin/seamless', ref)) {
    ref.tags = uniq([...ref.tags || [], 'plugin/seamless']);
  }
  c.instance.ref = ref;
  c.instance.fullscreen = pip;
  c.instance.init();
  return c;
}

export function createRef(vc: ViewContainerRef, ref: Ref, showToggle?: boolean): ComponentRef<RefComponent|CommentComponent> {
  if (hasTag('plugin/comment', ref)) {
    const c = vc.createComponent(CommentComponent);
    c.instance.ref = ref;
    c.instance.depth = 0;
    c.instance.init();
    return c;
  } else {
    const c = vc.createComponent(RefComponent);
    c.instance.ref = ref;
    c.instance.showToggle = !!showToggle;
    c.instance.expandInline = hasTag('plugin/thread', ref);
    c.instance.init();
    return c;
  }
}

export function createLens(vc: ViewContainerRef, params: any, page: Page<Ref>, tag: string, ext?: Ext): ComponentRef<LensComponent> {
  const c = vc.createComponent(LensComponent);
  c.instance.page = page;
  c.instance.pageControls = false;
  c.instance.tag = tag;
  c.instance.ext = ext;
  c.instance.size = params.size;
  c.instance.cols = params.cols;
  c.instance.sort = flatten([params.sort || []]);
  c.instance.filter = flatten([params.filter || []]);
  c.instance.search = params.search;
  c.instance.init();
  return c;
}

export async function createPip(vc: ViewContainerRef, ref: Ref) {
  // @ts-ignore
  const pipWindow = await documentPictureInPicture.requestWindow();
  const pipStyle = `
  <title>${ref.title}</title>
  <style>
    html {
      overflow: hidden;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      .embed {
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
  pipWindow.document.title = ref.title;
}
