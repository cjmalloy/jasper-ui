import { AfterViewInit, Directive, ElementRef, Input } from '@angular/core';
import { Ext } from '../model/ext';
import { hydrate } from '../model/tag';
import { getTemplateScope, Template } from '../model/template';

@Directive({
  selector: '[appTemplateUi]'
})
export class TemplateUiDirective implements AfterViewInit {

  @Input('appTemplateUi')
  templates!: Template[];
  @Input()
  ext!: Ext;

  constructor(private el: ElementRef) { }

  ngAfterViewInit(): void {
    this.el.nativeElement.innerHTML = this.templates.map(t => hydrate(t.config, 'ui', getTemplateScope(t, this.ext))).join();
  }
}
