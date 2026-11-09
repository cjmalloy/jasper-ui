/// <reference types="vitest/globals" />
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { FormlyFieldConfig, FormlyForm } from '@ngx-formly/core';
import { provideJasperFormly } from './formly.config';

@Component({
  template: `<formly-form [form]="form" [model]="model" [fields]="fields" />`,
  imports: [FormlyForm],
})
class FormlyHost {
  form = new FormGroup({});
  model: any = {};
  fields: FormlyFieldConfig[] = [];
}

describe('FormlyFieldTextArea', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideJasperFormly()] });
  });

  it('shows at least one row', async () => {
    const fixture = TestBed.createComponent(FormlyHost);
    fixture.componentInstance.fields = [{ key: 't', type: 'textarea', props: { rows: 0, cols: 0 } }];
    await fixture.whenStable();
    const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('textarea');
    expect(textarea.rows).toBe(1);
    expect(textarea.cols).toBe(1);
  });
});
