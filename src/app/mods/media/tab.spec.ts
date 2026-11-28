import * as Handlebars from 'handlebars/dist/cjs/handlebars';
import { beforeAll, describe, expect, it } from 'vitest';
import { tabPlugin } from './tab';

function render(comment: string) {
  const el = document.createElement('div');
  el.innerHTML = Handlebars.compile(tabPlugin.config!.ui!)({ ref: { comment } });
  return el;
}

function lines(el: Element) {
  return [...el.querySelectorAll(':scope > .tab-line')].map(l => l.textContent);
}

describe('guitar tab', () => {
  beforeAll(() => {
    const script = tabPlugin.config!.snippet!.match(/<script>([\s\S]*)<\/script>/)![1];
    new Function('Handlebars', script)(Handlebars);
  });

  it('should split a staff into bars with chords and lyrics aligned', () => {
    const el = render([
      '  Am          C',
      'e|-0-----0---|-0-----0---||',
      'B|---1-----1-|---1-----1-||',
      'G|-----2-----|-----0-----||',
      'D|-----------|-----------||',
      'A|-0---------|-3---------||',
      'E|-----------|-----------||',
      '  hel- lo      world',
    ].join('\n'));
    const system = el.querySelector('.tab-system')!;
    const bars = [...system.querySelectorAll('.tab-bar')];
    expect(bars.length).toBe(2);
    expect(lines(bars[0])).toEqual(['Am', '-0-----0---|', '---1-----1-|', '-----2-----|', '-----------|', '-0---------|', '-----------|', 'hel- lo']);
    expect(lines(bars[1])).toEqual(['C', '-0-----0---||', '---1-----1-||', '-----0-----||', '-----------||', '-3---------||', '-----------||', ' world']);
    expect((bars[0] as HTMLElement).style.width).toBe('12ch');
    const stacks = [...system.querySelectorAll('.tab-labels .tab-stack')];
    expect(stacks.length).toBe(2);
    expect(lines(stacks[1])).toEqual(['', 'e|', 'B|', 'G|', 'D|', 'A|', 'E|', '']);
  });

  it('should support any number of strings', () => {
    const el = render([
      'G|-------|-------|',
      'D|-------|-------|',
      'A|-------|-3-----|',
      'E|-0-3-5-|-------|',
    ].join('\n'));
    const bars = el.querySelectorAll('.tab-bar');
    expect(bars.length).toBe(2);
    expect(lines(bars[0]).length).toBe(4);
    expect(bars[0].querySelectorAll('.string').length).toBe(4);
  });

  it('should keep annotations that cross a bar in the bar where they start', () => {
    const el = render([
      '      Cmaj7',
      'e|-0-----|-0-----|',
      'B|-1-----|-1-----|',
    ].join('\n'));
    const bars = el.querySelectorAll('.tab-bar');
    expect(lines(bars[0])[0]).toBe('    Cmaj7');
    expect(lines(bars[1])[0]).toBe('');
  });

  it('should render headers and text without a staff as plain text', () => {
    const el = render('[Intro]\nG|---|---|\nD|-2-|---|\n\nAm   C\nsome lyrics');
    const texts = el.querySelectorAll('.tab-text');
    expect(texts.length).toBe(2);
    expect(lines(texts[0])).toEqual(['[Intro]']);
    expect(lines(texts[1])).toEqual(['Am   C', 'some lyrics']);
    expect(texts[1].querySelector('.chord')!.textContent).toBe('Am   C');
    expect(el.querySelectorAll('.tab-system').length).toBe(1);
  });

  it('should escape HTML', () => {
    const el = render('<b>x</b>');
    expect(el.querySelector('b')).toBeNull();
    expect(el.textContent).toContain('<b>x</b>');
  });
});
