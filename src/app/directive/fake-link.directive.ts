import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
  selector: '.fake-link',
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
  activateWithSpace(event: KeyboardEvent): void {
    event.preventDefault();
    this.elementRef.nativeElement.click();
  }

}
