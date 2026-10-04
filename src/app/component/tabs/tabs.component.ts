import { Component, ElementRef, Injector, contentChildren, computed, afterNextRender, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { SettingsComponent } from '../settings/settings.component';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.component.html',
  styleUrl: './tabs.component.scss',
  host: {
    'class': 'tabs',
  },
  imports: [ReactiveFormsModule, SettingsComponent]
})
export class TabsComponent {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private router = inject(Router);
  private injector = inject(Injector);

  readonly routerLinks = contentChildren(RouterLink);
  readonly anchors = contentChildren(RouterLink, { read: ElementRef });

  readonly options = computed(() => {
    return this.anchors().map(t => t.nativeElement as HTMLAnchorElement)
      .filter(el => el.tagName === 'A' && !el.classList.contains('logo'))
      .map((el, index) => ({ label: el.title || el.innerText, index }));
  });

  constructor() {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntilDestroyed(),
    ).subscribe(() => this.scrollCurrentTabIntoView());
  }

  private readonly initializeView = afterNextRender(() => {
    this.scrollCurrentTabIntoView();
  });

  nav(select: HTMLSelectElement) {
    const index = Number(select.value);
    if (!Number.isNaN(index)) this.routerLinks().at(index)?.onClick(0, false, false, false, false);
    select.selectedIndex = 0;
  }

  private scrollCurrentTabIntoView() {
    afterNextRender(() => {
      this.el.nativeElement.querySelector('.current-tab')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, { injector: this.injector });
  }

}
