import { Directive, ElementRef, input, linkedSignal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

@Directive({ selector: '[appAutofocus]', })
export class AutofocusDirective {

  readonly enabledInput = input<boolean | ''>(true, { alias: 'appAutofocus' });
  readonly enabled = linkedSignal(() => this.enabledInput());

  readonly select = input(true);

  constructor(
    private elementRef: ElementRef,
    private router: Router,
  ) {
    router.events.pipe(
      filter(event => event instanceof NavigationEnd),
    ).subscribe(() => this.focus());
  };

  ngOnInit(): void {
    this.focus();
  }

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
