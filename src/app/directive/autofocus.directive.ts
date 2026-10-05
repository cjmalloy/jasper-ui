import { afterNextRender, Directive, ElementRef, inject, input, linkedSignal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

@Directive({ selector: '[appAutofocus]', })
export class AutofocusDirective {
  private elementRef = inject(ElementRef);
  private router = inject(Router);


  readonly enabledInput = input<boolean | ''>(true, { alias: 'appAutofocus' });
  readonly enabled = linkedSignal(() => this.enabledInput());

  readonly select = input(true);

  constructor() {
    const router = this.router;

    router.events.pipe(
      filter(event => event instanceof NavigationEnd),
    ).subscribe(() => this.focus());
  };

  private readonly initialize = afterNextRender(() => {
    this.focus();
  });

  focus() {
    if (this.enabled() === false) return;
    this.enabled.set(false);
    this.elementRef.nativeElement.focus();
    if ('setSelectionRange' in this.elementRef.nativeElement) {
      try {
        this.elementRef.nativeElement.setSelectionRange(0, this.elementRef.nativeElement.value?.length || 0);
      } catch (e) {
        console.log('no selection range??');
      }
    }
  }

}
