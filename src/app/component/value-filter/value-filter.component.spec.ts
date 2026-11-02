/// <reference types="vitest/globals" />
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FilterConfig } from '../../model/tag';
import { AdminService } from '../../service/admin.service';
import { ValueFilterService } from '../../service/value-filter.service';
import { ValueFilterComponent } from './value-filter.component';

describe('ValueFilterComponent', () => {
  let fixture: ComponentFixture<ValueFilterComponent>;
  let changed: string[];
  const filters = signal<FilterConfig[]>([
    { sort: 'tags->plugin/duration:dur', before: 'pt5m', input: 'range' },
    { sort: 'plugins->_plugin/cache->contentLength:num', after: '10mb', input: 'units', unit: 'bytes' },
  ]);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ValueFilterComponent],
      providers: [
        { provide: AdminService, useValue: { filters } },
        { provide: ValueFilterService, useValue: { extent: () => of([90, 700]) } },
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

  describe('text', () => {
    it('trims the value', async () => {
      const el = await render('plugins->plugin/score:num/after/1000');
      const input = el.querySelector<HTMLInputElement>('.filter-value')!;
      input.value = ' 2000 ';
      input.dispatchEvent(new Event('change'));
      expect(changed).toEqual(['2000']);
      expect(input.value).toBe('2000');
    });

    it('restores an empty value or a value with /', async () => {
      const el = await render('plugins->plugin/score:num/after/1000');
      const input = el.querySelector<HTMLInputElement>('.filter-value')!;
      input.value = '';
      input.dispatchEvent(new Event('change'));
      input.value = '1/2';
      input.dispatchEvent(new Event('change'));
      expect(changed).toEqual([]);
      expect(input.value).toBe('1000');
    });
  });
});
