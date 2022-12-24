import { Directive, ElementRef, Input } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

@Directive({
  selector: '[appAutofocus]',
})
export class AutofocusDirective {

  @Input('appAutofocus')
  enabled: boolean | '' = true;

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
    if (this.enabled === false) return;
    this.elementRef.nativeElement.focus();
  }

}
