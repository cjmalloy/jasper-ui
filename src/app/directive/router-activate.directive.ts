import { Directive, HostListener, Input } from '@angular/core';
import { Router } from '@angular/router';

@Directive({ selector: '[appRouterActivate]' })
export class RouterActivateDirective {

  @Input('appRouterActivate')
  commands: any[] = [];
  @Input()
  queryParams: any;

  @HostListener('[dblclick, $event]')
  onDblClick(event: MouseEvent) {
    this.activate();
  }

  @HostListener('[keydown, $event]')
  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') this.activate();
  }

  constructor(
    private router: Router,
  ) { }

  private activate() {
    this.router.navigate(this.commands, { queryParams: this.queryParams });
  }
}
