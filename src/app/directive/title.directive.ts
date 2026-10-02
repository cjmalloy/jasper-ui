import { Directive, effect, ElementRef, input } from '@angular/core';
import { isArray, isString, uniq } from 'lodash-es';
import { Ext } from '../model/ext';
import { getPluginScope } from '../model/plugin';
import { Ref } from '../model/ref';
import { hydrate, Visibility } from '../model/tag';
import { getTemplateScope } from '../model/template';
import { TagPreview } from '../service/editor.service';
import { Store } from '../store/store';

@Directive({ selector: '[appTitle]' })
export class TitleDirective {

  readonly node = input<Visibility | Visibility[] | Ext | string | TagPreview | undefined>(undefined, { alias: 'appTitle' });
  readonly ref = input<Ref | undefined>();

  constructor(
    private store: Store,
    private el: ElementRef,
  ) {
    effect(() => this.render());
  }

  render(): void {
    const node = this.node();
    if (!node) return;
    const ref = this.ref();
    const title: string[] = [];
    for (const n of isArray(node) ? node : [node]) {
      if (isString(n)) {
        title.push(n);
      } else if ('type' in n && n.type === 'ext') {
        const ctx = getTemplateScope(this.store.account.roles(), null!, n);
        title.push(
          n.config?.popover
          ? hydrate(n.config, 'popover', ctx)
          : ''
        );
      } else if ('title' in n) {
        const ctx = getPluginScope(n._parent, ref)
        title.push(hydrate(n, 'title', ctx));
      } else if ('_parent' in n && n._parent) {
        const ctx = getPluginScope(n._parent, ref)
        title.push(
          n._parent.config?.description
          ? hydrate(n._parent.config, 'description', ctx)
          : ''
        );
      }
    }
    this.el.nativeElement.title = uniq(title).join($localize` / `);
  }

}
