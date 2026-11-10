/// <reference types="vitest/globals" />
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { FormlyFieldConfig, FormlyForm } from '@ngx-formly/core';
import { DurationInputAccessor, durationIndex, DurationOption, durationSeconds, FormlyFieldDuration, toDuration } from './duration.type';
import { provideJasperFormly } from './formly.config';

const datalist: DurationOption[] = [
  { value: 'PT0.0000005S', label: 'Unlimited' },
  { value: 'PT0.1S', label: '100 ms' },
  { value: 'PT1S', label: '1 second' },
  { value: 'PT1M', label: '1 min' },
];

@Component({
  template: `<input type="range" min="0" [max]="datalist().length - 1" [duration]="datalist()" [formControl]="control">`,
  imports: [ReactiveFormsModule, DurationInputAccessor],
})
class HostComponent {
  readonly datalist = signal(datalist);
  control = new FormControl<string | number>('PT2S', { nonNullable: true });
}

describe('FormlyFieldDuration', () => {
  it('parses ISO and numeric seconds', () => {
    expect(toDuration('PT1S')!.toMillis()).toBe(1000);
    expect(toDuration(1)!.toMillis()).toBe(1000);
    expect(toDuration(undefined)).toBeUndefined();
  });

  it('keeps sub-millisecond precision', () => {
    expect(durationSeconds('PT0.0000005S')).toBe(0.0000005);
    expect(durationSeconds(0.0000005)).toBe(0.0000005);
    expect(durationSeconds('PT0.0005S')).toBe(0.0005);
    expect(durationSeconds('PT1.5S')).toBe(1.5);
    expect(durationSeconds('PT1M0.1S')).toBe(60.1);
    expect(durationSeconds('bad')).toBeUndefined();
  });

  it('finds exact or nearest slider position', () => {
    expect(durationIndex(datalist, 'PT0.0000005S')).toBe(0);
    expect(durationIndex(datalist, 'PT1S')).toBe(2);
    expect(durationIndex(datalist, 1)).toBe(2);
    expect(durationIndex(datalist, 'PT2S')).toBe(2);
    expect(durationIndex(datalist, 'PT1H')).toBe(3);
    expect(durationIndex(datalist, 'bad')).toBe(0);
  });

  it('formats datalist labels, numbers and values not in the list', () => {
    const field = TestBed.runInInjectionContext(() => new FormlyFieldDuration());
    expect(field.formatInterval('PT0.0000005S', datalist)).toBe('Unlimited');
    expect(field.formatInterval(0.0000005, datalist)).toBe('Unlimited');
    expect(field.formatInterval('PT0.0005S', datalist)).not.toBe('Unlimited');
    expect(field.formatInterval(1, datalist)).toBe('1 second');
    expect(field.formatInterval('PT2S', datalist)).toBe('2 seconds');
    expect(field.formatInterval('PT2S')).toBe('2 seconds');
  });

  it('keeps a value not in the datalist until the user moves the slider', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.debugElement.query(By.css('input')).nativeElement;
    expect(fixture.componentInstance.control.value).toBe('PT2S');
    expect(fixture.componentInstance.control.dirty).toBe(false);
    expect(input.value).toBe('2');

    input.value = '1';
    input.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.control.value).toBe('PT0.1S');
  });

  it('picks the first stop when clicked without a value', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.control.setValue(undefined as any);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.debugElement.query(By.css('input')).nativeElement;
    expect(input.value).toBe('0');
    expect(fixture.componentInstance.control.value).toBeUndefined();

    input.dispatchEvent(new Event('click'));
    expect(fixture.componentInstance.control.value).toBe('PT0.0000005S');

    fixture.componentInstance.control.setValue('PT1M');
    input.value = '0';
    input.dispatchEvent(new Event('click'));
    expect(fixture.componentInstance.control.value).toBe('PT1M');
  });
});

@Component({
  template: `<formly-form [form]="form" [model]="model" [fields]="fields" />`,
  imports: [FormlyForm],
})
class FormlyHost {
  form = new FormGroup({});
  model: any = {};
  fields: FormlyFieldConfig[] = [];
}

describe('FormlyFieldDuration label', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideJasperFormly()] });
  });

  async function label(field: FormlyFieldConfig, model: any = {}) {
    const fixture = TestBed.createComponent(FormlyHost);
    fixture.componentInstance.fields = [field];
    fixture.componentInstance.model = model;
    await fixture.whenStable();
    return (fixture.nativeElement as HTMLElement).querySelector('.duration-label')!.textContent!.trim();
  }

  it('shows the value', async () => {
    expect(await label({ key: 'd', type: 'duration' }, { d: 'PT1M' })).toBe('1 min');
  });

  it('shows a placeholder without a value', async () => {
    expect(await label({ key: 'd', type: 'duration' })).toBe('Not set');
    expect(await label({ key: 'd', type: 'duration', props: { placeholder: 'Default' } })).toBe('Default');
  });
});
