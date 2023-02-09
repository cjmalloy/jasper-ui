import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { autorun, runInAction } from 'mobx';
import { of } from 'rxjs';
import { Store } from '../store/store';
import { AdminService } from './admin.service';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private config: ConfigService,
    private admin: AdminService,
    private store: Store,
    private titleService: Title,
  ) {
    this.setTheme(localStorage.getItem('theme'));
  }

  get init$() {
    autorun(() => this.setCustomCss('custom-css', this.store.account.theme || this.store.view.ext?.config?.themes?.[this.store.view.ext?.config?.theme]));
    this.admin.pluginConfigProperty('css').map(p => this.setCustomCss(p.tag, p.config!.css));
    return of(null);
  }

  toggle() {
    if (this.store.theme === 'light-theme') {
      this.setTheme('dark-theme');
    } else {
      this.setTheme('light-theme');
    }
  }

  setCustomCss(id: string, css?: string) {
    id = id.replace(/\W/g, '-');
    const old = this.document.getElementById(id)
    if (old) old.remove();
    if (!css) return;
    const head = this.document.getElementsByTagName('head')[0];
    const style = this.document.createElement('style');
    style.id = id;
    style.innerHTML = css;
    head.appendChild(style);
  }

  getSystemTheme(): string {
    const darkThemeMq = window.matchMedia('(prefers-color-scheme: dark)');
    return darkThemeMq.matches ? 'dark-theme' : 'light-theme';
  }

  setTheme(theme?: string | null) {
    const sysDefault = this.getSystemTheme();
    theme ??= sysDefault;
    if (this.store.theme === theme) return;
    if (theme !== sysDefault) {
      localStorage.setItem('theme', theme);
    } else {
      localStorage.removeItem('theme');
    }
    document.body.classList.add(theme);
    document.body.classList.remove(this.store.theme);
    runInAction(() => this.store.theme = theme!);
  }

  setTitle(title: string) {
    this.titleService.setTitle(`${this.config.title} ± ${title}`);
  }
}
