/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Store } from '../../store/store';
import { RelativeDateComponent } from './relative-date.component';

describe('RelativeDateComponent', () => {
  let fixture: ComponentFixture<RelativeDateComponent>;
  let changed: string[];

  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  async function render(value: string) {
    fixture = TestBed.createComponent(RelativeDateComponent);
    fixture.componentRef.setInput('value', value);
    changed = [];
    fixture.componentInstance.changed.subscribe(v => changed.push(v));
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the nearest preset', async () => {
    const el = await render('P1D');
    expect(el.querySelector<HTMLInputElement>('input')!.value).toBe('5');
    expect(el.querySelector('output')!.textContent).toBe('24 hours');
  });

  it('previews while sliding and sets on change', async () => {
    const el = await render('now');
    const range = el.querySelector<HTMLInputElement>('input')!;
    range.value = '2';
    range.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(el.querySelector('output')!.textContent).toBe('15 minutes');
    expect(changed).toEqual([]);
    range.dispatchEvent(new Event('change'));
    expect(changed).toEqual(['PT15M']);
  });

  it('slides between presets while dragging with the hotkey', async () => {
    const el = await render('P3D');
    const range = el.querySelector<HTMLInputElement>('input')!;
    range.dispatchEvent(new Event('pointerdown'));
    TestBed.inject(Store).hotkey.set(true);
    await fixture.whenStable();
    expect(range.step).toBe('any');
    // Between 3 and 7 days
    range.value = '6.5';
    range.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(el.querySelector('output')!.textContent).toBe('4 days, 14 hours');
    range.dispatchEvent(new Event('change'));
    expect(changed).toEqual(['P4DT14H']);
  });

  it('places a value between presets', async () => {
    const el = await render('P4DT14H');
    expect(el.querySelector('output')!.textContent).toBe('4 days, 14 hours');
    expect(fixture.componentInstance.index()).toBeCloseTo(6.5, 1);
  });
});
