import { Directive, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { isArray, isString, uniq } from 'lodash-es';
import { Ext } from '../model/ext';
import { getPluginScope } from '../model/plugin';
import { Ref } from '../model/ref';
import { hydrate, Visibility } from '../model/tag';
import { getTemplateScope } from '../model/template';
import { Store } from '../store/store';

@Directive({
  standalone: false,
  selector: '[appTitle]'
})
export class TitleDirective implements OnChanges {

  @Input('appTitle')
  node?: Visibility | Visibility[] | Ext | string;
  @Input()
  ref?: Ref;

  constructor(
    private store: Store,
    private el: ElementRef,
  ) { }

  ngOnChanges(changes: SimpleChanges) {
    this.render();
  }

  render(): void {
    if (!this.node) return;
    const title: string[] = [];
    for (const n of isArray(this.node) ? this.node : [this.node]) {
      if (isString(n)) {
        title.push(n);
      } else if ('type' in n && n.type === 'ext') {
        const ctx = getTemplateScope(this.store.account, null!, n);
        title.push(
          n.config?.popover
          ? hydrate(n.config, 'popover', ctx)
          : ''
        );
      } else if ('title' in n) {
        const ctx = getPluginScope(n._parent, this.ref)
        title.push(hydrate(n, 'title', ctx));
      } else if ('_parent' in n && n._parent) {
        const ctx = getPluginScope(n._parent, this.ref)
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
