import { AfterViewInit, Directive, ElementRef, Input } from '@angular/core';
import { Ext } from '../model/ext';
import { renderTemplates, Template } from '../model/template';

@Directive({
  selector: '[appTemplateUi]'
})
export class TemplateUiDirective implements AfterViewInit {

  @Input("appTemplateUi")
  templates!: Template[];
  @Input()
  ext!: Ext;

  constructor(private el: ElementRef) { }

  ngAfterViewInit(): void {
    this.el.nativeElement.innerHTML = renderTemplates(this.templates, this.ext);
  }
}
