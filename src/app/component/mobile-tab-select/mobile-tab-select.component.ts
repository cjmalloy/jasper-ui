import { Component, HostBinding, Input } from '@angular/core';
import { defer } from 'lodash-es';

@Component({
  selector: 'app-mobile-tab-select',
  templateUrl: './mobile-tab-select.component.html',
  styleUrls: ['./mobile-tab-select.component.scss']
})
export class MobileTabSelectComponent {

  @HostBinding('class.dn')
  get noOptions() {
    return this.options.length < 2;
  }

  options: string[] = [];

  map = new Map<string, HTMLElement>();

  @Input('tabs')
  set tabs(value: HTMLElement) {
    this.options = [];
    this.map.clear();
    if (!value) return;
    defer(() => {
      for (const c of value.querySelectorAll('.tabs > a:not(.logo)') as any as HTMLAnchorElement[] || []) {
        const value = c.title || c.innerText;
        this.options.push(value);
        this.map.set(value, c);
      }
    });
  }

  nav(select: HTMLSelectElement) {
    if (select.value && this.map.get(select.value)) {
      this.map.get(select.value)!.click();
    }
    select.selectedIndex = 0;
  }
}
