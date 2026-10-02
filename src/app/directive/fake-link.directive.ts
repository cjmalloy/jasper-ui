import { Directive, ElementRef } from '@angular/core';

@Directive({
  selector: '.fake-link',
  host: {
    role: 'button',
    tabindex: '0',
    '(keydown.enter)': 'activateWithEnter()',
    '(keydown.space)': 'preventSpaceScroll($event)',
    '(keyup.space)': 'activateWithSpace()',
  },
})
export class FakeLinkDirective {

  constructor(private elementRef: ElementRef<HTMLElement>) { }

  activateWithEnter(): void {
    this.elementRef.nativeElement.click();
  }

  preventSpaceScroll(event: Event): void {
    event.preventDefault();
  }

  activateWithSpace(): void {
    this.elementRef.nativeElement.click();
  }

}
