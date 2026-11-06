/// <reference types="vitest/globals" />
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, of, Subject } from 'rxjs';
import { FilterConfig } from '../../model/tag';
import { AdminService } from '../../service/admin.service';
import { ValueFilterService } from '../../service/value-filter.service';
import { Store } from '../../store/store';
import { ValueFilterComponent } from './value-filter.component';

describe('ValueFilterComponent', () => {
  let fixture: ComponentFixture<ValueFilterComponent>;
  let changed: string[];
  let extent: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
  const filters = signal<FilterConfig[]>([
    { sort: 'tags->plugin/duration:dur', before: 'pt5m', input: 'range' },
    { sort: 'plugins->_plugin/cache->contentLength:num', after: '10mb', input: 'units', unit: 'bytes' },
    { sort: 'plugins->size:num', after: '1mb', input: 'range', hotkeyInput: 'units', unit: 'bytes' },
    { sort: 'plugins->plugin/test->status', equals: 'open', input: 'select', options: [{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }] },
    { sort: 'plugins->plugin/test->color', equals: 'red', input: 'select' },
    { sort: 'plugins->plugin/test->name', equals: 'kiwi', input: 'select' },
  ]);
  const plugin = {
    tag: 'plugin/test',
    config: { form: [{ key: 'color', type: 'radio', props: { options: [{ value: 'red', label: 'Red' }, { value: 'blue', label: 'Blue' }] } }] },
  };

  beforeEach(async () => {
    extent = vi.fn<(...args: any[]) => any>(() => of([90, 700]));
    await TestBed.configureTestingModule({
      imports: [ValueFilterComponent],
      providers: [
        provideRouter([]),
        { provide: AdminService, useValue: { filters, getPlugin: (tag: string) => tag === plugin.tag ? plugin : undefined } },
        { provide: ValueFilterService, useValue: { extent: (...args: any[]) => extent(...args) } },
      ],
    }).compileComponents();
  });

  async function render(filter: string) {
    fixture = TestBed.createComponent(ValueFilterComponent);
    fixture.componentRef.setInput('filter', filter);
    changed = [];
    fixture.componentInstance.changed.subscribe(value => changed.push(value));
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  describe('range', () => {
    it('slides over the stops around the values found', async () => {
      const el = await render('tags->plugin/duration:dur/before/pt5m');
      const range = el.querySelector<HTMLInputElement>('.filter-range')!;
      expect(range.max).toBe('4');
      expect(range.value).toBe('2');
      range.value = '4';
      range.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      expect(el.querySelector('.filter-range-label')!.textContent).toContain('15');
      expect(changed).toEqual([]);
      range.dispatchEvent(new Event('change'));
      expect(changed).toEqual(['pt15m']);
    });

    it('finds the range in the query, ignoring value changes', async () => {
      fixture = TestBed.createComponent(ValueFilterComponent);
      fixture.componentRef.setInput('filter', 'tags->plugin/duration:dur/before/pt5m');
      fixture.componentRef.setInput('query', 'music');
      await fixture.whenStable();
      expect(extent).toHaveBeenCalledTimes(1);
      expect(extent).toHaveBeenLastCalledWith('tags->plugin/duration:dur', 'duration', 'music');
      fixture.componentRef.setInput('filter', 'tags->plugin/duration:dur/before/pt15m');
      await fixture.whenStable();
      expect(extent).toHaveBeenCalledTimes(1);
      fixture.componentRef.setInput('query', 'science');
      await fixture.whenStable();
      expect(extent).toHaveBeenCalledTimes(2);
      expect(extent).toHaveBeenLastCalledWith('tags->plugin/duration:dur', 'duration', 'science');
    });

    it('keeps the dragged value when the range loads mid-drag', async () => {
      const el = await render('tags->plugin/duration:dur/before/pt5m');
      const loaded = new Subject<number[]>();
      extent.mockReturnValue(loaded);
      fixture.componentRef.setInput('query', 'science');
      fixture.detectChanges();
      const range = el.querySelector<HTMLInputElement>('.filter-range')!;
      expect(range.getAttribute('aria-valuetext')).toBe('5 min');
      range.value = String(+range.value + 1);
      range.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      const label = el.querySelector('.filter-range-label')!.textContent;
      expect(label).not.toBe('5 min');
      loaded.next([120, 7200]);
      loaded.complete();
      await fixture.whenStable();
      expect(el.querySelector('.filter-range-label')!.textContent).toBe(label);
      expect(range.getAttribute('aria-valuetext')).toBe(label);
    });

    it('keeps a dragged value outside the range that loads mid-drag', async () => {
      const el = await render('tags->plugin/duration:dur/before/pt5m');
      const loaded = new Subject<number[]>();
      extent.mockReturnValue(loaded);
      fixture.componentRef.setInput('query', 'science');
      fixture.detectChanges();
      const range = el.querySelector<HTMLInputElement>('.filter-range')!;
      range.value = range.max;
      range.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(el.querySelector('.filter-range-label')!.textContent).toBe('15 min');
      loaded.next([120, 600]);
      loaded.complete();
      await fixture.whenStable();
      expect(el.querySelector('.filter-range-label')!.textContent).toBe('15 min');
      range.dispatchEvent(new Event('change'));
      expect(changed).toEqual(['pt15m']);
    });

    it('keeps the range while a new query loads', async () => {
      const el = await render('tags->plugin/duration:dur/before/pt5m');
      extent.mockReturnValue(NEVER);
      fixture.componentRef.setInput('query', 'science');
      fixture.detectChanges();
      expect(el.querySelector<HTMLInputElement>('.filter-range')!.max).toBe('4');
    });

    it('types any value while the hotkey is held', async () => {
      const el = await render('tags->plugin/duration:dur/before/pt5m');
      TestBed.inject(Store).hotkey.set(true);
      await fixture.whenStable();
      expect(el.querySelector('.filter-range')).toBeNull();
      const input = el.querySelector<HTMLInputElement>('.filter-value')!;
      expect(input.value).toBe('pt5m');
      input.dispatchEvent(new Event('focus'));
      TestBed.inject(Store).hotkey.set(false);
      await fixture.whenStable();
      expect(el.querySelector('.filter-value')).toBe(input);
      input.value = 'PT1H30M';
      input.dispatchEvent(new Event('change'));
      expect(changed).toEqual(['PT1H30M']);
      fixture.componentRef.setInput('filter', 'tags->plugin/duration:dur/before/PT1H30M');
      await fixture.whenStable();
      expect(el.querySelector('.filter-value')).toBeNull();
      expect(el.querySelector('.filter-range-label')!.textContent).toContain('1 hr, 30 min');
    });

    it('turns off snapping while dragging with the hotkey', async () => {
      const el = await render('tags->plugin/duration:dur/before/pt5m');
      const store = TestBed.inject(Store);
      const range = el.querySelector<HTMLInputElement>('.filter-range')!;
      range.dispatchEvent(new Event('pointerdown'));
      store.hotkey.set(true);
      await fixture.whenStable();
      expect(el.querySelector('.filter-range')).toBe(range);
      expect(range.step).toBe('any');
      range.value = '2.5';
      range.dispatchEvent(new Event('input'));
      range.dispatchEvent(new Event('pointerup'));
      range.dispatchEvent(new Event('change'));
      // Halfway between 5 and 10 minutes on a log scale
      expect(changed).toEqual(['pt7m4s']);
      store.hotkey.set(false);
      await fixture.whenStable();
      expect(el.querySelector('.filter-range')).toBe(range);
    });

    it('keeps fine tuning when the hotkey is released while dragging', async () => {
      const el = await render('tags->plugin/duration:dur/before/pt5m');
      const store = TestBed.inject(Store);
      const range = el.querySelector<HTMLInputElement>('.filter-range')!;
      const label = () => el.querySelector('.filter-range-label')!.textContent;
      range.dispatchEvent(new Event('pointerdown'));
      expect(range.step).toBe('1');
      store.hotkey.set(true);
      await fixture.whenStable();
      expect(range.step).toBe('any');
      range.value = '2.5';
      range.dispatchEvent(new Event('input'));
      store.hotkey.set(false);
      await fixture.whenStable();
      expect(label()).toBe('7 min, 4 sec');
      expect(range.step).toBe('any');
      range.value = '2.6';
      range.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      expect(label()).not.toBe('10 min');
      range.dispatchEvent(new Event('pointerup'));
      range.dispatchEvent(new Event('change'));
      expect(changed[0]).toMatch(/^pt7m\d+s$/);
      // The next drag snaps to stops again
      range.dispatchEvent(new Event('pointerdown'));
      await fixture.whenStable();
      expect(range.step).toBe('1');
    });

    it('commits the fine value when the hotkey is released before the slider', async () => {
      const el = await render('tags->plugin/duration:dur/before/pt5m');
      const store = TestBed.inject(Store);
      const range = el.querySelector<HTMLInputElement>('.filter-range')!;
      range.dispatchEvent(new Event('pointerdown'));
      store.hotkey.set(true);
      await fixture.whenStable();
      range.value = '2.5';
      range.dispatchEvent(new Event('input'));
      store.hotkey.set(false);
      await fixture.whenStable();
      range.dispatchEvent(new Event('pointerup'));
      range.dispatchEvent(new Event('change'));
      expect(changed).toEqual(['pt7m4s']);
    });

    it('resumes fine tuning when the hotkey is pressed again while dragging', async () => {
      const el = await render('tags->plugin/duration:dur/before/pt5m');
      const store = TestBed.inject(Store);
      const range = el.querySelector<HTMLInputElement>('.filter-range')!;
      range.dispatchEvent(new Event('pointerdown'));
      store.hotkey.set(true);
      await fixture.whenStable();
      store.hotkey.set(false);
      await fixture.whenStable();
      store.hotkey.set(true);
      await fixture.whenStable();
      expect(el.querySelector('.filter-range')).toBe(range);
      expect(el.querySelector('.filter-value')).toBeNull();
      range.value = '2.5';
      range.dispatchEvent(new Event('input'));
      range.dispatchEvent(new Event('pointerup'));
      range.dispatchEvent(new Event('change'));
      expect(changed).toEqual(['pt7m4s']);
    });

    it('shows a number and unit while the hotkey is held', async () => {
      const el = await render('plugins->size:num/after/1mb');
      expect(el.querySelector('.filter-range')).not.toBeNull();
      TestBed.inject(Store).hotkey.set(true);
      await fixture.whenStable();
      expect(el.querySelector('.filter-range')).toBeNull();
      expect(el.querySelector<HTMLInputElement>('.filter-value')!.value).toBe('1');
      const unit = el.querySelector<HTMLSelectElement>('.filter-unit')!;
      expect(unit.value).toBe('mb');
      expect(el.querySelector('.filter-range-label')!.textContent).toBe('1 MB');
      unit.dispatchEvent(new Event('focus'));
      TestBed.inject(Store).hotkey.set(false);
      await fixture.whenStable();
      expect(el.querySelector('.filter-unit')).toBe(unit);
      unit.value = 'kb';
      unit.dispatchEvent(new Event('change'));
      expect(changed).toEqual(['1kb']);
      unit.dispatchEvent(new Event('blur'));
      await fixture.whenStable();
      expect(el.querySelector('.filter-range')).not.toBeNull();
    });

    it('shows shorthand from the URL', async () => {
      const el = await render('tags->plugin/duration:dur/before/10m');
      expect(el.querySelector<HTMLInputElement>('.filter-range')!.value).toBe('3');
    });

    it('falls back to text for a value it cannot read', async () => {
      const el = await render('tags->plugin/duration:dur/before/soon');
      expect(el.querySelector('.filter-range')).toBeNull();
      expect(el.querySelector<HTMLInputElement>('.filter-value')!.value).toBe('soon');
    });
  });

  describe('units', () => {
    it('shows the number and unit', async () => {
      const el = await render('plugins->_plugin/cache->contentLength:num/after/10485760');
      expect(el.querySelector<HTMLInputElement>('.filter-value')!.value).toBe('10');
      expect(el.querySelector<HTMLSelectElement>('.filter-unit')!.value).toBe('mb');
    });

    it('keeps the unit for a number', async () => {
      const el = await render('plugins->_plugin/cache->contentLength:num/after/10mb');
      const input = el.querySelector<HTMLInputElement>('.filter-value')!;
      input.value = ' 20 ';
      input.dispatchEvent(new Event('change'));
      expect(changed).toEqual(['20mb']);
      expect(input.value).toBe('20');
    });

    it('picks the unit from shorthand', async () => {
      const el = await render('plugins->_plugin/cache->contentLength:num/after/10mb');
      const input = el.querySelector<HTMLInputElement>('.filter-value')!;
      input.value = '500 KB';
      input.dispatchEvent(new Event('change'));
      expect(changed).toEqual(['500kb']);
      expect(input.value).toBe('500');
    });

    it('changes the unit', async () => {
      const el = await render('plugins->_plugin/cache->contentLength:num/after/10mb');
      const select = el.querySelector<HTMLSelectElement>('.filter-unit')!;
      select.value = 'gb';
      select.dispatchEvent(new Event('change'));
      expect(changed).toEqual(['10gb']);
    });

    it('restores an invalid number', async () => {
      const el = await render('plugins->_plugin/cache->contentLength:num/after/10mb');
      const input = el.querySelector<HTMLInputElement>('.filter-value')!;
      input.value = 'lots';
      input.dispatchEvent(new Event('change'));
      expect(changed).toEqual([]);
      expect(input.value).toBe('10');
    });
  });

  describe('select', () => {
    it('picks from the filter config options', async () => {
      const el = await render('plugins->plugin/test->status/equals/open');
      const select = el.querySelector<HTMLSelectElement>('.filter-option')!;
      expect([...select.options].map(o => o.textContent)).toEqual(['Open', 'Closed']);
      expect(select.value).toBe('open');
      select.value = 'closed';
      select.dispatchEvent(new Event('change'));
      expect(changed).toEqual(['closed']);
    });

    it('defaults to the options of the plugin form field', async () => {
      const el = await render('plugins->plugin/test->color/equals/blue');
      const select = el.querySelector<HTMLSelectElement>('.filter-option')!;
      expect([...select.options].map(o => o.textContent)).toEqual(['Red', 'Blue']);
      expect(select.value).toBe('blue');
    });

    it('shows a value that is not an option', async () => {
      const el = await render('plugins->plugin/test->status/equals/other');
      const select = el.querySelector<HTMLSelectElement>('.filter-option')!;
      expect([...select.options].map(o => o.textContent)).toEqual(['Open', 'Closed', 'other']);
      expect(select.value).toBe('other');
    });

    it('falls back to text without options', async () => {
      const el = await render('plugins->plugin/test->name/equals/kiwi');
      expect(el.querySelector('.filter-option')).toBeNull();
      expect(el.querySelector<HTMLInputElement>('.filter-value')!.value).toBe('kiwi');
    });
  });

  describe('text', () => {
    it('trims the value', async () => {
      const el = await render('plugins->plugin/score:num/after/1000');
      const input = el.querySelector<HTMLInputElement>('.filter-value')!;
      input.value = ' 2000 ';
      input.dispatchEvent(new Event('change'));
      expect(changed).toEqual(['2000']);
      expect(input.value).toBe('2000');
    });

    it('restores an empty value or a value with /, , or ->', async () => {
      const el = await render('plugins->plugin/score:num/after/1000');
      const input = el.querySelector<HTMLInputElement>('.filter-value')!;
      input.value = '';
      input.dispatchEvent(new Event('change'));
      input.value = '1/2';
      input.dispatchEvent(new Event('change'));
      input.value = '1,000';
      input.dispatchEvent(new Event('change'));
      input.value = 'a->b';
      input.dispatchEvent(new Event('change'));
      expect(changed).toEqual([]);
      expect(input.value).toBe('1000');
    });
  });
});
