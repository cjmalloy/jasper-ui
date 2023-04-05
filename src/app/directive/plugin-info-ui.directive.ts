import { Directive, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Plugin, renderPlugin, renderPluginInfo } from '../model/plugin';
import { Ref } from '../model/ref';

@Directive({
  selector: '[appPluginInfoUi]'
})
export class PluginInfoUiDirective implements OnChanges {

  @Input("appPluginInfoUi")
  plugin!: Plugin;
  @Input()
  ref?: Ref;

  constructor(private el: ElementRef) { }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.ref) this.render();
  }

  render(): void {
    this.el.nativeElement.innerHTML = renderPluginInfo(this.plugin, this.ref);
  }

}
