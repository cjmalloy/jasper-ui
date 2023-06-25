import { Directive, EventEmitter, HostListener, Input, Output } from '@angular/core';

@Directive({
  selector: '[appInputDone]'
})
export class InputDoneDirective {

  @Output('appInputDone')
  done = new EventEmitter<void>();

  @Input('last')
  last = false;

  @HostListener('keydown', ['$event'])
  keydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || this.last && (event.key === 'Tab' || event.which === 229 || event.keyCode == 9)) {
      event.preventDefault();
      this.done.next();
    }
  }
}
