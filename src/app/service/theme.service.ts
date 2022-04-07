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
