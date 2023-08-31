import { AfterViewInit, Directive, ElementRef, Input } from '@angular/core';
import { Ext } from '../model/ext';
import { hydrate } from '../model/tag';
import { getTemplateScope, Template } from '../model/template';
import { Store } from '../store/store';

@Directive({
  selector: '[appTemplateUi]'
})
export class TemplateUiDirective implements AfterViewInit {

  @Input('appTemplateUi')
  templates!: Template[];
  @Input()
  ext!: Ext;

  constructor(
    private store: Store,
    private el: ElementRef,
  ) { }

  ngAfterViewInit(): void {
    this.el.nativeElement.innerHTML = this.templates.map(t => hydrate(t.config, 'ui', getTemplateScope(this.store.account.roles, t, this.ext))).join();
  }
}
