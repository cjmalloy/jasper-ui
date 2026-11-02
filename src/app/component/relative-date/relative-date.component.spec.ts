/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RelativeDateComponent } from './relative-date.component';

describe('RelativeDateComponent', () => {
  let fixture: ComponentFixture<RelativeDateComponent>;
  let changed: string[];

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
});
