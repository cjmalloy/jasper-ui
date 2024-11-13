import { ComponentRef } from '@angular/core';
import { Ext } from '../model/ext';
import { Page } from '../model/page';
import { Ref, RefPageArgs } from '../model/ref';

export interface Embed {
  createLink(url: string, text: string, title?: string, css?: string): ComponentRef<any>;
  createEmbed(ref: Ref, expandPlugins: string[]): ComponentRef<any>;
  createEmbed(url: string, expandPlugins: string[]): ComponentRef<any>;
  createRef(ref: Ref, showToggle?: boolean): ComponentRef<any>;
  createLens(params: any, page: Page<Ref>, tag: string, ext?: Ext): ComponentRef<any>;
}
