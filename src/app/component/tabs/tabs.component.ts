import {
  afterNextRender,
  afterRenderEffect,
  Component,
  computed,
  contentChildren,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  untracked
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { throttle } from 'lodash-es';
import { ConfigService } from '../../service/config.service';
import { SettingsComponent } from '../settings/settings.component';

/**
 * Width of the overflow dropdown including margin.
 */
const MOBILE_SELECT_WIDTH = 52;

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.component.html',
  styleUrl: './tabs.component.scss',
  host: {
    'class': 'tabs',
    '[class.measuring]': 'measuring()',
    '[class.floating-tabs]': 'floatingTabs()',
  },
  imports: [ReactiveFormsModule, SettingsComponent]
})
export class TabsComponent {
  private config = inject(ConfigService);
  private el = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly routerLinks = contentChildren(RouterLink);
  readonly anchors = contentChildren(RouterLink, { read: ElementRef });

  readonly options = computed(() => {
    return this.anchors()
      .map((anchor, index) => ({ el: anchor.nativeElement as HTMLElement, index }))
      .filter(({ el }) => el.tagName === 'A' && !el.classList.contains('logo'))
      .map(({ el, index }) => ({ label: el.title || el.innerText, index }));
  });

  /**
   * Number of tabs moved into the overflow dropdown.
   */
  readonly hidden = signal(0);
  /**
   * Tabs are laid out invisibly until they have been measured.
   */
  readonly measuring = signal(true);
  readonly floatingTabs = computed(() => this.config.mini() || this.hidden() > 0 && this.hidden() === this.options().length);

  private tabWidths: number[] = [];
  private resizeObserver = window.ResizeObserver && new ResizeObserver(() => this.onResize()) || undefined;

  constructor() {
    // Measure tab widths in the DOM whenever the projected tabs change
    afterRenderEffect(() => {
      this.anchors();
      untracked(() => this.updateTabs());
    });
    afterNextRender(() => {
      this.resizeObserver?.observe(this.el.nativeElement.parentElement!);
    });
    inject(DestroyRef).onDestroy(() => {
      this.resizeObserver?.disconnect();
      this.onResize.cancel();
    });
  }

  nav(select: HTMLSelectElement) {
    const index = Number(select.value);
    if (!Number.isNaN(index)) this.routerLinks().at(index)?.onClick(0, false, false, false, false);
    select.selectedIndex = 0;
    this.measureVisible();
  }

  private onResize = throttle(() => {
    if (document.body.classList.contains('fullscreen')) return;
    this.measureVisible();
  }, 16, { leading: true, trailing: true });

  private get tabs() {
    return this.anchors()
      .map(a => a.nativeElement as HTMLElement)
      .filter(el => el.tagName === 'A' && !el.classList.contains('logo'));
  }

  private updateTabs() {
    const tabs = this.tabs;
    for (const el of tabs) el.style.display = '';
    this.tabWidths = tabs.map(el => el.offsetWidth + 8.5);
    this.measureVisible();
  }

  private measureVisible() {
    const count = this.options().length;
    this.hidden.set(count ? count - this.visible(count) : 0);
    this.hideTabs();
    this.measuring.set(false);
  }

  private hideTabs() {
    const hidden = this.hidden();
    let i = this.tabWidths.length - 1;
    for (const el of this.tabs) {
      if (el.classList.contains('current-tab')) {
        el.style.display = 'inline-block';
      } else {
        el.style.display = i > hidden ? 'inline-block' : 'none';
        i--;
      }
    }
  }

  private get currentTabWidth() {
    const current = this.tabs.find(el => el.classList.contains('current-tab'));
    return current ? current.offsetWidth + 8.5 : 0;
  }

  /**
   * Widths of permanent children including the overflow dropdown.
   */
  private get childWidths() {
    const el = this.el.nativeElement;
    const result: number[] = [MOBILE_SELECT_WIDTH];
    for (let i = 0; i < el.children.length; i++) {
      const e = el.children[i] as HTMLElement;
      if (e.tagName === 'A' && !e.classList.contains('logo')) continue;
      if (e.classList.contains('mobile-tab-select')) continue;
      if (this.config.mobile()) {
        if (e.tagName === 'H5') continue;
        if (e.classList.contains('logo')) continue;
      }
      result.push(e.offsetWidth + (e.classList.contains('settings') ? 0 : 8));
    }
    return result;
  }

  /**
   * Number of visible tabs, including the current tab.
   */
  private visible(count: number) {
    const current = this.currentTabWidth;
    if (!current) return count;
    if (this.config.mini()) return 0;
    const width = this.el.nativeElement.offsetWidth - 2;
    let result = 1;
    let childWidth = current + this.childWidths.reduce((a, b) => a + b);
    if (childWidth > width) return 0;
    let skipped = false;
    for (const w of this.tabWidths) {
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
    return count;
  }

}
