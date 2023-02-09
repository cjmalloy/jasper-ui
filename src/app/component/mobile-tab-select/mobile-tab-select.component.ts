import { AfterViewInit, Component, Input } from '@angular/core';

@Component({
  selector: 'app-mobile-tab-select',
  templateUrl: './mobile-tab-select.component.html',
  styleUrls: ['./mobile-tab-select.component.scss']
})
export class MobileTabSelectComponent implements AfterViewInit {

  @Input('tabs')
  tabs?: HTMLElement;
  options: string[] = [];

  map = new Map<string, HTMLElement>();

  ngAfterViewInit(): void {
    this.options = [];
    if (!this.tabs) return;
    for (const c of this.tabs.querySelectorAll('.tabs > a') as any as HTMLAnchorElement[] || []) {
      this.options.push(c.innerText);
      this.map.set(c.innerText, c);
    }
  }

  nav(select: HTMLSelectElement) {
    if (select.value && this.map.get(select.value)) {
      this.map.get(select.value)!.click();
    }
    select.selectedIndex = 0;
  }
}
