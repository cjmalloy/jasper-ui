import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  contentChildren,
  effect,
  signal,
  computed
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { defer } from 'lodash-es';
import { ConfigService } from '../../service/config.service';
import { SettingsComponent } from '../settings/settings.component';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.component.html',
  styleUrl: './tabs.component.scss',
  host: {
    'class': 'tabs',
    '[class.measuring]': 'measuring()',
    '[class.floating-tabs]': 'floatingTabs',
    '(window:resize)': 'onResize()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SettingsComponent]
})
export class TabsComponent implements AfterViewInit {

  readonly routerLinks = contentChildren(RouterLink);
  readonly anchors = contentChildren(RouterLink, { read: ElementRef });

  readonly options = signal<string[]>([], { equal: () => false });
  readonly hidden = signal(0);
  readonly measuring = signal(true);

  map = new Map<string, number>();


  private resizeObserver = window.ResizeObserver && new ResizeObserver(() => this.onResize()) || undefined;
  private destroyed = false;

  constructor(
    private config: ConfigService,
    private el: ElementRef<HTMLElement>,
    destroyRef: DestroyRef,
  ) {
    destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.resizeObserver?.disconnect();
    });
    effect(() => {
      this.anchors();
      defer(() => {
        if (this.destroyed) return;
        this.measuring.set(true);
        this.updateTabs();
      });
    });
  }

  ngAfterViewInit() {
    this.updateTabs();
    defer(() => !this.destroyed && this.resizeObserver?.observe(this.el.nativeElement!.parentElement!));
  }

  get floatingTabs() {
    return this.config.mini || this.hidden() > 0 && this.hidden() === this.options().length;
  }

  onResize() {
    if (!this.options().length) return;
    defer(() => {
      if (this.destroyed) return;
      if (!document.body.classList.contains('fullscreen')) {
        this.measureVisible();
      }
    });
  }

  measureVisible() {
    if (!this.options().length) return;
    this.hidden.set(this.options().length - this.visible);
    this.hideTabs();
  }

  updateTabs() {
    this.hidden.set(0);
    const options: string[] = [];
    this.map.clear();
    const tabs = this.anchors();
    for (const t of tabs) {
      const el = t.nativeElement as HTMLAnchorElement;
      if (el.tagName !== 'A') continue;
      if (el.classList.contains('logo')) continue;
      const value = el.title || el.innerText;
      options.push(value);
      this.map.set(value, tabs.indexOf(t));
    }
    this.options.set(options);
    defer(() => !this.destroyed && this.onResize());
  }

  hideTabs() {
    const tabs = this.anchors();
    let i = this.options().length - 1;
    for (const t of tabs) {
      const el = t.nativeElement as HTMLAnchorElement;
      if (el.tagName !== 'A') continue;
      if (el.classList.contains('logo')) continue;
      if (el.classList.contains('current-tab')) {
        el.style.display = 'inline-block';
      } else {
        el.style.display = i > this.hidden() ? 'inline-block' : 'none';
        i--;
      }
    }
    this.measuring.set(false);
  }
  readonly tabWidths = computed(() => {
    const result: number[] = [];
    const tabs = this.anchors();
    for (const t of tabs) {
      const el = t.nativeElement as HTMLAnchorElement;
      if (el.tagName !== 'A') continue;
      if (el.classList.contains('logo')) continue;
      result.push(el.offsetWidth + 8.5);
    }
    return result;
  });

  get currentTabWidth() {
    const el = this.el.nativeElement;
    for (let i = 0; i < el.children.length; i++) {
      const e = el.children[i] as HTMLElement;
      if (!e.classList.contains('current-tab')) continue;
      return e.offsetWidth + 8.5;
    }
    return 0;
  }

  /**
   * Widths of permanent children including the overflow dropdown.
   */
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
      result.push(e.offsetWidth + (e.classList.contains('settings') ? 0 : 8));
    }
    if (!mobileSelect) {
      result.push(52);
    }
    return result;
  }

  /**
   * Number of visible tabs, including the current tab.
   */
  get visible() {
    const current = this.currentTabWidth;
    if (!current) return this.options().length;
    if (this.config.mini) return 0;
    const el = this.el.nativeElement;
    const width = el.offsetWidth - 2;
    let result = 1;
    let childWidth = current + this.childWidths.reduce((a, b) => a + b);
    if (childWidth > width) return 0;
    let skipped = false;
    for (const w of this.tabWidths()) {
      if (!skipped && w === current) {
        skipped = true;
        continue;
      }
      childWidth += w;
      if (childWidth + current < width) {
        result++;
      } else {
        return result;
      }
    }
    return this.options().length;
  }

  nav(select: HTMLSelectElement) {
    if (select.value && this.map.has(select.value)) {
      this.routerLinks().at(this.map.get(select.value)!)?.onClick(0, false, false, false, false);
    }
    select.selectedIndex = 0;
    this.measureVisible();
  }

}
