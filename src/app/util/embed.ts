import { ComponentRef } from '@angular/core';
import { Page } from '../model/page';
import { Ref } from '../model/ref';

export interface Embed {
  createLink(url: string, text: string, title?: string, css?: string): ComponentRef<any>;
  createEmbed(ref: Ref, expandPlugins: string[]): ComponentRef<any>;
  createEmbed(url: string, expandPlugins: string[]): ComponentRef<any>;
  createRef(ref: Ref, showToggle?: boolean): ComponentRef<any>;
  createRefList(page: Page<Ref>, pageControls?: boolean): ComponentRef<any>;
}
