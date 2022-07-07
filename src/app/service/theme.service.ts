import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { AccountService } from './account.service';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {

  public static THEMES = ['light-theme', 'dark-theme'];

  private theme = 'init-theme';

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private config: ConfigService,
    private titleService: Title,
    private account: AccountService,
  ) {
    this.setTheme(localStorage.getItem('theme'));
    this.account.watchTheme$.subscribe(css => this.setCustomCss(css));
  }

  toggle() {
    if (this.getTheme() === 'light-theme') {
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

  getTheme() {
    if (this.theme) return this.theme;
    return this.getSystemTheme();
  }

  getSystemTheme(): string {
    const darkThemeMq = window.matchMedia('(prefers-color-scheme: dark)');
    return darkThemeMq.matches ? 'dark-theme' : 'light-theme';
  }

  setTheme(theme?: string | null) {
    const sysDefault = this.getSystemTheme();
    theme ??= sysDefault;
    if (this.theme === theme) return;
    if (theme !== sysDefault) {
      localStorage.setItem('theme', theme);
    } else {
      localStorage.removeItem('theme');
    }
    document.body.classList.add(theme);
    document.body.classList.remove(this.theme);
    this.theme = theme;
  }

  setTitle(title: string) {
    this.titleService.setTitle(`${this.config.title} ± ${title}`);
  }
}
