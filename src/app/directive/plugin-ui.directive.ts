import { AfterViewInit, Directive, ElementRef, Input } from '@angular/core';
import { Plugin, renderPlugin } from '../model/plugin';
import { Ref } from '../model/ref';

@Directive({
  selector: '[appPluginUi]'
})
export class PluginUiDirective implements AfterViewInit {

  @Input("appPluginUi")
  plugin!: Plugin;
  @Input()
  ref?: Ref;

  constructor(private el: ElementRef) { }

  ngAfterViewInit(): void {
    this.el.nativeElement.innerHTML = renderPlugin(this.plugin, this.ref);
  }

}
