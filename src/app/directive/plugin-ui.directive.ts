import {
  AfterContentChecked,
  AfterViewInit,
  Directive,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import { Plugin, renderPlugin } from '../model/plugin';
import { Ref } from '../model/ref';

@Directive({
  selector: '[appPluginUi]'
})
export class PluginUiDirective implements OnChanges {

  @Input("appPluginUi")
  plugin!: Plugin;
  @Input()
  ref?: Ref;

  constructor(private el: ElementRef) { }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.ref) this.render();
  }

  render(): void {
    this.el.nativeElement.innerHTML = renderPlugin(this.plugin, this.ref);
  }

}
