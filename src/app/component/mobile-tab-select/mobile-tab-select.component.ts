import { Component, Input } from '@angular/core';
import { defer } from 'lodash-es';

@Component({
  selector: 'app-mobile-tab-select',
  templateUrl: './mobile-tab-select.component.html',
  styleUrls: ['./mobile-tab-select.component.scss']
})
export class MobileTabSelectComponent {

  options: string[] = [];

  map = new Map<string, HTMLElement>();

  @Input('tabs')
  set tabs(value: HTMLElement) {
    this.options = [];
    if (!value) return;
    defer(() => {
      for (const c of value.querySelectorAll('.tabs > a') as any as HTMLAnchorElement[] || []) {
        this.options.push(c.innerText);
        this.map.set(c.innerText, c);
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
