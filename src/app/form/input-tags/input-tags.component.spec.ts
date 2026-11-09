/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ExtService } from '../../service/api/ext.service';

import { InputTagsComponent } from './input-tags.component';

describe('InputTagsComponent', () => {
  let component: InputTagsComponent;
  let fixture: ComponentFixture<InputTagsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InputTagsComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InputTagsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('templates', ['car/<Year>/<Make>', '+plugin/secret']);
    fixture.detectChanges();
  });

  it('shows a row per template and an input per placeholder', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.input-tag').length).toBe(2);
    expect(el.querySelectorAll('.input-tag')[0].querySelectorAll('input').length).toBe(2);
    expect(el.querySelectorAll('.input-tag')[1].querySelectorAll('input').length).toBe(1);
    expect(el.querySelectorAll('.input-tag')[0].querySelectorAll('input')[1].placeholder).toBe('Make');
  });

  it('emits the tags once they are filled out', () => {
    const emitted: string[][] = [];
    component.tagsChange.subscribe(tags => emitted.push(tags));
    component.setValue(0, 1, 'toyota');
    component.setValue(1, 0, 'openai');
    component.setValue(0, 0, '2020');
    expect(emitted).toEqual([
      ['', ''],
      ['', '+plugin/secret/openai'],
      ['car/2020/toyota', '+plugin/secret/openai'],
    ]);
  });

  it('shows a dropdown for a segment with commas', () => {
    const emitted: string[][] = [];
    component.tagsChange.subscribe(tags => emitted.push(tags));
    fixture.componentRef.setInput('templates', ['+plugin,_plugin/secret/<Secret>']);
    fixture.detectChanges();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('.input-tag select');
    expect([...select.options].map(o => o.value)).toEqual(['+plugin', '_plugin']);
    expect(select.value).toBe('+plugin');
    component.setValue(0, 1, 'openai');
    select.value = '_plugin';
    select.dispatchEvent(new Event('change'));
    expect(emitted).toEqual([['+plugin/secret/openai'], ['_plugin/secret/openai']]);
  });

  it('suggests every possibility when filled out of order', async () => {
    vi.useFakeTimers();
    const page = vi.spyOn(TestBed.inject(ExtService), 'page').mockReturnValue(of({
      content: [{ tag: 'car/2020', name: '2020' }, { tag: 'car/2020/toyota', name: 'Toyota' }, { tag: 'car/2020/honda/civic', name: 'Civic' }, { tag: 'car/2021/toyota' }],
      page: { number: 0, size: 50, totalElements: 3, totalPages: 1 },
    } as any));
    component.search(0, 2);
    vi.advanceTimersByTime(300);
    expect(page).toHaveBeenCalledWith(expect.objectContaining({ query: 'car' }));
    expect(component.autocomplete()).toEqual([{ value: 'toyota', label: 'Toyota' }, { value: 'honda', label: 'honda' }]);
    vi.useRealTimers();
  });
});
