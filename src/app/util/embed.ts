import { ComponentRef } from '@angular/core';
import { Page } from '../model/page';
import { Ref } from '../model/ref';

export interface Embed {
  createEmbed(ref: Ref, expandPlugins?: string[]): ComponentRef<any>;
  createEmbed(url: string): ComponentRef<any>;
  createRef(ref: Ref, showToggle?: boolean): ComponentRef<any>;
  createRefList(page: Page<Ref>, pageControls?: boolean): ComponentRef<any>;
}
