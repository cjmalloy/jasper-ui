import { Directive, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { isString } from 'lodash-es';
import { Ext } from '../model/ext';
import { getPluginScope } from '../model/plugin';
import { Ref } from '../model/ref';
import { hydrate, Visibility } from '../model/tag';
import { getTemplateScope } from '../model/template';
import { Store } from '../store/store';

@Directive({
  selector: '[appTitle]'
})
export class TitleDirective implements OnChanges {

  @Input('appTitle')
  node?: Visibility | Ext | string;
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
    if (isString(this.node)) {
      this.el.nativeElement.title = this.node;
    } else if ('type' in this.node && this.node.type === 'ext') {
      const ctx = getTemplateScope(this.store.account, null!, this.node);
      this.el.nativeElement.title
        = this.node.config.popover
        ? hydrate(this.node.config, 'popover', ctx)
        : '';
    } else if ('_parent' in this.node && this.node._parent) {
      const ctx = getPluginScope(this.node._parent, this.ref)
      this.el.nativeElement.title
        = this.node._parent.config?.description
        ? hydrate(this.node._parent.config, 'description', ctx)
        : this.node.title
        ? hydrate(this.node, 'title', ctx)
        : '';
    }
  }

}
