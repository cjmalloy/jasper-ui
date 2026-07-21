import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
  selector: '.fake-link, .parent-link',
  host: {
    role: 'button',
    tabindex: '0',
  },
})
export class FakeLinkDirective {

  constructor(private elementRef: ElementRef<HTMLElement>) { }

  @HostListener('keydown.enter')
  activateWithEnter(): void {
    this.elementRef.nativeElement.click();
  }

  @HostListener('keydown.space', ['$event'])
  preventSpaceScroll(event: Event): void {
    event.preventDefault();
  }

  @HostListener('keyup.space')
  activateWithSpace(): void {
    this.elementRef.nativeElement.click();
  }

}
