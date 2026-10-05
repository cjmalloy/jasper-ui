/// <reference types="vitest/globals" />
import { newTheme, THEME_VARS, themeVars } from './theme';

describe('Theme Utils', () => {
  let style: HTMLStyleElement;

  beforeEach(() => {
    style = document.createElement('style');
    style.textContent = `
      body { --bg: white; --text: black; }
      body.light-theme { --text: #111; }
      body.dark-theme { --bg: #343434; --text: #c9c9c9; }
    `;
    document.head.appendChild(style);
  });

  afterEach(() => style.remove());

  it('reads light values with body defaults', () => {
    const vars = themeVars('light');
    expect(vars['--bg']).toBe('white');
    expect(vars['--text']).toBe('#111');
  });

  it('reads dark values', () => {
    const vars = themeVars('dark');
    expect(vars['--bg']).toBe('#343434');
    expect(vars['--text']).toBe('#c9c9c9');
  });

  it('creates a theme with every standard var for light and dark', () => {
    const css = newTheme();
    expect(css).toContain('body.light-theme {');
    expect(css).toContain('body.dark-theme {');
    expect(css).toContain('--bg: #343434; /* Page background */');
    expect(css).toContain('--text: #111; /* Main text colour */');
    for (const v of THEME_VARS) {
      expect(css.match(new RegExp(`^  (/\\* )?${v.name}:`, 'gm'))?.length).toBe(2);
    }
  });
});
