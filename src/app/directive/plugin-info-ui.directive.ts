import { Directive, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { getPluginScope, Plugin } from '../model/plugin';
import { Ref } from '../model/ref';
import { hydrate } from '../model/tag';

@Directive({
  selector: '[appPluginInfoUi]'
})
export class PluginInfoUiDirective implements OnChanges {

  @Input("appPluginInfoUi")
  plugin?: Plugin;
  @Input()
  ref?: Ref;

  constructor(private el: ElementRef) { }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.ref) this.render();
  }

  render(): void {
    if (!this.plugin) return;
    this.el.nativeElement.innerHTML = hydrate(this.plugin.config, 'infoUi', getPluginScope(this.plugin, this.ref));
  }

}
