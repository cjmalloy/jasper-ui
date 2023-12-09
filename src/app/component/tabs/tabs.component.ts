import { AfterViewInit, Component, ContentChildren, ElementRef, HostBinding, QueryList } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.component.html',
  styleUrl: './tabs.component.scss'
})
export class TabsComponent implements AfterViewInit {
  @HostBinding('class') css = 'tabs';

  @ContentChildren(RouterLink)
  routerLinks!: QueryList<RouterLink>;
  @ContentChildren(RouterLink, { read: ElementRef })
  anchors!: QueryList<ElementRef>;

  options: string[] = [];
  map = new Map<string, number>();

  constructor(
    private router: Router
  ) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => this.updateTabs());
  }

  ngAfterViewInit() {
    this.updateTabs();
    this.anchors.changes.subscribe(value => {
      this.updateTabs();
    });
  }

  updateTabs() {
    this.options = [];
    this.map.clear();
    const tabs = this.anchors.toArray();
    for (const t of tabs) {
      const el = t.nativeElement as HTMLAnchorElement;
      if (el.tagName !== 'A') continue;
      if (el.classList.contains('logo')) continue;
      const value = el.title || el.innerText;
      this.options.push(value);
      this.map.set(value, tabs.indexOf(t));
    }
  }

  nav(select: HTMLSelectElement) {
    if (select.value && this.map.has(select.value)) {
      this.routerLinks.get(this.map.get(select.value)!)?.onClick(0, false, false, false, false);
    }
    select.selectedIndex = 0;
  }

}
