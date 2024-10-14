import {
  AfterViewInit,
  Component,
  ContentChildren,
  ElementRef,
  HostBinding,
  HostListener,
  QueryList
} from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { defer, throttle } from 'lodash-es';
import { filter } from 'rxjs';
import { ConfigService } from '../../service/config.service';
import { memo, MemoCache } from '../../util/memo';

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

  private _hidden = 0;
  private resizeObserver = window.ResizeObserver && new ResizeObserver(() => this.onResize()) || undefined;

  constructor(
    private config: ConfigService,
    private router: Router,
    private el: ElementRef<HTMLElement>,
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
    this.resizeObserver?.observe(this.el.nativeElement!.parentElement!);
  }

  @HostBinding('class.floating-tabs')
  get floatingTabs() {
    return this.hidden > 0 && this.hidden === this.options.length;
  }

  get hidden(): number {
    return this._hidden;
  }

  set hidden(value: number) {
    this._hidden = value;
    this.hideTabs();
  }

  @HostListener('window:resize')
  onResize() {
    if (!this.options.length) return;
    this.measureVisible();
  }

  measureVisible = throttle(() => {
    if (!this.options.length) return;
    this.hidden = this.options.length - this.visible;
  }, 400, { leading: true, trailing: true });

  updateTabs() {
    MemoCache.clear(this);
    this.options = [];
    this.map.clear();
    const tabs = this.anchors.toArray();
    for (const t of tabs) {
      const el = t.nativeElement as HTMLAnchorElement;
      if (el.classList.contains('logo')) continue;
      const value = el.title || el.innerText;
      this.options.push(value);
      this.map.set(value, tabs.indexOf(t));
    }
    defer(() => this.onResize());
  }

  hideTabs() {
    const tabs = this.anchors.toArray();
    let i = tabs.length - 2;
    for (const t of tabs) {
      const el = t.nativeElement as HTMLAnchorElement;
      if (el.tagName !== 'A') continue;
      if (el.classList.contains('logo')) continue;
      if (el.classList.contains('current-tab')) {
        el.style.display = 'inline-block';
        console.log(i, 'current-tab');
        continue;
      }
      console.log(i, this.hidden, i > this.hidden);
      el.style.display = i > this.hidden ? 'inline-block' : 'none';
      i--;
    }
  }

  @memo
  get tabWidths() {
    const result: number[] = [];
    const tabs = this.anchors.toArray();
    for (const t of tabs) {
      const el = t.nativeElement as HTMLAnchorElement;
      if (el.classList.contains('logo')) continue;
      result.push(el.offsetWidth + 10);
    }
    return result;
  }

  get currentTabWidth() {
    const el = this.el.nativeElement;
    for (let i = 0; i < el.children.length; i++) {
      const e = el.children[i] as HTMLElement;
      if (!e.classList.contains('current-tab')) continue;
      return e.offsetWidth + 10;
    }
    return 0;
  }

  get childWidths() {
    const el = this.el.nativeElement;
    const result: number[] = [];
    let mobileSelect = false;
    for (let i = 0; i < el.children.length; i++) {
      const e = el.children[i] as HTMLElement;
      if (e.tagName === 'A' && !e.classList.contains('logo')) continue;
      if (this.config.mobile) {
        if (e.tagName === 'H5') continue;
        if (e.classList.contains('logo')) continue;
      }
      if (e.classList.contains('mobile-tab-select')) mobileSelect = true;
      result.push(e.offsetWidth);
    }
    if (!mobileSelect) {
      result.push(52);
    }
    return result;
  }

  get visible() {
    const current = this.currentTabWidth;
    if (!current) return this.options.length;
    const el = this.el.nativeElement;
    const width = el.offsetWidth;
    let result = 1;
    let childWidth = this.childWidths.reduce((a, b) => a + b);
    if (childWidth > width) return 0;
    childWidth += current;
    let skipped = false;
    for (const w of this.tabWidths) {
      if (!skipped && w === current) {
        skipped = true;
        continue;
      }
      childWidth += w;
      if (childWidth < width) {
        result++;
      } else {
        return result;
      }
    }
    return result;
  }

  nav(select: HTMLSelectElement) {
    if (select.value && this.map.has(select.value)) {
      this.routerLinks.get(this.map.get(select.value)!)?.onClick(0, false, false, false, false);
    }
    select.selectedIndex = 0;
    this.measureVisible();
  }

}
