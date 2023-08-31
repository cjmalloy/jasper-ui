import { Directive, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { getPluginScope, Plugin } from '../model/plugin';
import { Ref } from '../model/ref';
import { hydrate } from '../model/tag';

@Directive({
  selector: '[appPluginUi]'
})
export class PluginUiDirective implements OnChanges {

  @Input('appPluginUi')
  plugin?: Plugin;
  @Input()
  ref?: Ref;

  constructor(private el: ElementRef) { }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.ref) this.render();
  }

  render(): void {
    if (!this.plugin?.config?.ui) return;
    this.el.nativeElement.innerHTML = hydrate(this.plugin.config, 'ui', getPluginScope(this.plugin, this.ref));
  }

}
