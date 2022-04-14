import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {

  public static THEMES = ['light-theme', 'dark-theme'];

  private theme = 'init-theme';

  constructor(
    @Inject(DOCUMENT) private document: Document,
  ) {
    this.setTheme();
  }

  toggle() {
    if (this.getTheme() === 'light-theme') {
      this.setTheme('dark-theme');
    } else {
      this.setTheme('light-theme');
    }
  }

  getTheme() {
    if (this.theme) return this.theme;
    return this.getSystemTheme();
  }

  getSystemTheme(): string {
    const darkThemeMq = window.matchMedia('(prefers-color-scheme: dark)');
    return darkThemeMq.matches ? 'dark-theme' : 'light-theme';
  }

  setTheme(theme?: string) {
    theme ??= this.getSystemTheme();
    if (this.theme === theme) return;
    document.body.classList.add(theme);
    document.body.classList.remove(this.theme);
    this.theme = theme;
  }
}
