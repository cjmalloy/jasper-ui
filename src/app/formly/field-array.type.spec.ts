/// <reference types="vitest/globals" />
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { FieldType, FormlyFieldConfig, FormlyForm, provideFormlyConfig } from '@ngx-formly/core';
import { Store } from '../store/store';
import { provideJasperFormly } from './formly.config';
import { ListTypeComponent } from './list.type';

@Component({ template: '' })
class TestField extends FieldType {}

@Component({
  template: `
    <formly-form [form]="form" [model]="model" [fields]="list" />
    <formly-form [form]="form" [model]="model" [fields]="other" />
  `,
  imports: [FormlyForm],
})
class SharedFormHost {
  form = new FormGroup({});
  model: any = { tags: ['a'] };
  list: FormlyFieldConfig[] = [{ key: 'tags', type: 'list', fieldArray: { type: 'test' } }];
  other: FormlyFieldConfig[] = [{ key: 'other', type: 'test' }];
}

describe('JasperFieldArrayType', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideJasperFormly(),
        provideFormlyConfig({ types: [{ name: 'test', component: TestField }] }),
        { provide: Store, useValue: { hotkey: () => false } },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(SharedFormHost);
    await fixture.whenStable();
    const list = fixture.debugElement.query(By.directive(ListTypeComponent)).componentInstance as ListTypeComponent;
    return { fixture, list };
  }

  it('adds rows when another formly-form shares the form', async () => {
    const { fixture, list } = await render();
    list.add(0, 'b');
    await fixture.whenStable();
    expect(fixture.componentInstance.form.value).toEqual({ tags: ['b', 'a'], other: undefined });
  });

  it('removes rows when another formly-form shares the form', async () => {
    const { fixture, list } = await render();
    list.remove(0);
    await fixture.whenStable();
    expect(fixture.componentInstance.form.value).toEqual({ tags: [], other: undefined });
  });
});
