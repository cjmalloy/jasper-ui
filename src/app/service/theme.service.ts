import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { autorun, runInAction } from 'mobx';
import { Store } from '../store/store';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private config: ConfigService,
    private store: Store,
    private titleService: Title,
  ) {
    this.setTheme(localStorage.getItem('theme'));
    autorun(() => this.setCustomCss(store.account.theme || store.view.ext?.config?.themes?.[store.view.ext?.config?.theme]));
  }

  toggle() {
    if (this.store.theme === 'light-theme') {
      this.setTheme('dark-theme');
    } else {
      this.setTheme('light-theme');
    }
  }

  setCustomCss(css?: string) {
    const old = this.document.getElementById('custom-css')
    if (old) old.remove();
    if (!css) return;
    const head = this.document.getElementsByTagName('head')[0];
    const style = this.document.createElement('style');
    style.id = 'custom-css';
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
