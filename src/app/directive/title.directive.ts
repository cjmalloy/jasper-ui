import { Directive, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { getPluginScope } from '../model/plugin';
import { Ref } from '../model/ref';
import { hydrate, Visibility } from '../model/tag';

@Directive({
  selector: '[appTitle]'
})
export class TitleDirective implements OnChanges {

  @Input('appTitle')
  node?: Visibility;
  @Input()
  ref?: Ref;

  constructor(private el: ElementRef) { }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.ref) this.render();
  }

  render(): void {
    if (!this.node) return;
    const ctx = getPluginScope(this.node._parent, this.ref)
    this.el.nativeElement.title = this.node.title ? hydrate(this.node, 'title', ctx) : '';
  }

}
