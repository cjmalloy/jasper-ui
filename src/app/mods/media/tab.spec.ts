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
    const script = tabPlugin.config!.snippet!.match(/<script>([\s\S]*)<\/script>/i)![1];
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

  it('should render headers and chords with lyrics outside a staff', () => {
    const el = render('[Intro]\nG|---|---|\nD|-2-|---|\n\nAm   C\nsome lyrics');
    const texts = el.querySelectorAll('.tab-text');
    expect(texts.length).toBe(1);
    expect(texts[0].querySelector('.header')!.textContent).toBe('[Intro]');
    expect(el.querySelectorAll('.tab-system').length).toBe(1);
    const chunks = [...el.querySelectorAll('.tab-chords .tab-chunk')];
    expect(chunks.map(c => lines(c))).toEqual([['Am   ', 'some '], ['C', 'lyrics']]);
  });

  it('should keep chords over the middle of a word together', () => {
    const el = render('     G\nholiday now');
    const chunks = [...el.querySelectorAll('.tab-chunk')];
    expect(chunks.map(c => lines(c))).toEqual([['     G', 'holiday '], ['', 'now']]);
  });

  it('should render chord progressions and fingering legends', () => {
    const el = render('Am:  x02210\nE7   020100\n\n[Solo]\nEm  Am  D  G');
    const legends = [...el.querySelectorAll('.legend')];
    expect(legends.map(l => l.querySelector('.chord')!.textContent)).toEqual(['Am', 'E7']);
    expect(el.querySelector('.header')!.textContent).toBe('[Solo]');
    const chunks = [...el.querySelectorAll('.tab-chords .tab-chunk')];
    expect(chunks.map(c => lines(c))).toEqual([['Em  '], ['Am  '], ['D  '], ['G']]);
  });

  it('should rejoin chords and lyrics wrapped by copy and paste', () => {
    const el = render([
      'Em                 G                    ',
      '            D',
      "I'd like to get to know you a little ",
      'better babe',
    ].join('\n'));
    const block = el.querySelector('.tab-chords')!;
    const chord = [...block.querySelectorAll('.chord')].map(l => l.textContent).join('');
    const text = [...block.querySelectorAll('.text')].map(l => l.textContent).join('');
    expect(chord.trimEnd()).toBe('Em                 G' + ' '.repeat(32) + 'D');
    expect(text).toBe("I'd like to get to know you a little better babe");
  });

  it('should rejoin a wrapped staff onto its labels', () => {
    const el = render([
      '      G',
      'e|----3-----16p14-1',
      'B|----3------------',
      '   Bm',
      '4h16--2--|',
      '---------|',
    ].join('\n'));
    expect(el.querySelectorAll('.tab-system').length).toBe(1);
    const bar = el.querySelector('.tab-bar')!;
    expect(lines(bar)).toEqual(['    G               Bm', '----3-----16p14-14h16--2--|', '----3---------------------|']);
  });

  it('should split long bars where every string is empty', () => {
    const el = render([
      'e|' + '-0-2-3-'.repeat(8) + '|',
      'B|' + '-------'.repeat(8) + '|',
    ].join('\n'));
    const bars = [...el.querySelectorAll('.tab-bar')];
    expect(bars.length).toBeGreaterThan(1);
    expect(bars.map(b => lines(b)[0]).join('')).toBe('-0-2-3-'.repeat(8) + '|');
    for (const b of bars) expect(lines(b)[0]![0]).toBe('-');
    expect(el.querySelectorAll('.tab-stack').length).toBe(bars.length);
  });

  it('should keep labels before an opening double bar', () => {
    const el = render('e||-0-|-2-||\nB||-1-|-3-||');
    expect(lines(el.querySelector('.tab-stack')!)).toEqual(['e||', 'B||']);
    expect(lines(el.querySelector('.tab-bar')!)).toEqual(['-0-|', '-1-|']);
  });

  it('should keep tuning headers above a staff intact', () => {
    const el = render('Tuning: E A D G B E\ne|-0-|-2-|\nB|-1-|-3-|');
    expect(el.querySelector('.header')!.textContent).toBe('Tuning: E A D G B E');
    expect(el.querySelectorAll('.tab-bar .header').length).toBe(0);
  });

  it('should separate chords when rejoining a wrapped chord line', () => {
    const el = render('C                            Em\nAm\nsome words for the song that are long enough');
    const chord = [...el.querySelectorAll('.tab-chords .chord')].map(l => l.textContent).join('');
    expect(chord.trimEnd()).toBe('C                            Em Am');
  });

  it('should escape HTML', () => {
    const el = render('<b>x</b>');
    expect(el.querySelector('b')).toBeNull();
    expect(el.textContent).toContain('<b>x</b>');
  });
});
