import { Directive, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { getPluginScope } from '../model/plugin';
import { Ref } from '../model/ref';
import { Action, hydrate } from '../model/tag';

@Directive({
  selector: '[appActionLabel]'
})
export class ActionLabelDirective implements OnChanges {

  @Input('appActionLabel')
  action?: Action;
  @Input()
  field = 'label';
  @Input()
  ref?: Ref;

  constructor(private el: ElementRef) { }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.ref) this.render();
  }

  render(): void {
    // @ts-ignore
    if (!this.action?.[this.field]) return;
    const ctx = getPluginScope(this.action._parent!, this.ref)
    this.el.nativeElement.innerHTML = hydrate(this.action, this.field, ctx);
  }

}
