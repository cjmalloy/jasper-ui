/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { FormlyFieldConfig, FormlyForm } from '@ngx-formly/core';
import { of } from 'rxjs';
import { ExtService } from '../service/api/ext.service';
import { AuthzService } from '../service/authz.service';
import { EditorService } from '../service/editor.service';
import { provideJasperFormly } from './formly.config';
import { FormlyFieldStencil } from './stencil.type';

@Component({
  template: `<formly-form [form]="form" [model]="model" [fields]="fields" />`,
  imports: [FormlyForm],
})
class Host {
  form = new FormGroup({});
  model: any = {};
  fields: FormlyFieldConfig[] = [];
}

describe('FormlyFieldStencil', () => {
  let canAddTag: (tag?: string) => boolean;

  beforeEach(() => {
    canAddTag = () => true;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
        provideJasperFormly(),
        { provide: AuthzService, useValue: { canAddTag: (tag?: string) => canAddTag(tag) } },
      ],
    });
    vi.spyOn(TestBed.inject(EditorService), 'getTagsPreview').mockImplementation(tags => of(tags.map(tag => ({
      tag,
      name: tag.endsWith('plugin/secret') ? 'Secrets' : tag === 'car' ? 'Cars' : undefined,
    }))));
    vi.spyOn(TestBed.inject(ExtService), 'getCachedExt').mockImplementation(tag => of(tag === 'car/2020' ?
      { tag, name: '2020 Cars', modified: {} } as any :
      { tag }));
  });

  async function render(template: string) {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.fields = [{ key: 'tag', type: 'stencil', props: { template, required: true } }];
    await fixture.whenStable();
    const field = fixture.debugElement.query(By.directive(FormlyFieldStencil)).componentInstance as FormlyFieldStencil;
    return { fixture, field, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the prefix preview and an input per placeholder', async () => {
    const { el } = await render('car/<Year>/<Make>');
    expect(el.querySelector('.tag-preview')!.textContent!.trim()).toBe('Cars');
    expect(el.querySelector('.tag-preview')!.getAttribute('title')).toBe('car');
    expect(el.querySelectorAll('.stencil input.tag-input').length).toBe(2);
    expect(el.querySelectorAll<HTMLInputElement>('.stencil input.tag-input')[1].placeholder).toBe('Make');
  });

  it('shows the preview of filled out inputs that are not being edited', async () => {
    const { fixture, field, el } = await render('car/<Year>/<Make>');
    field.setValue(1, '2020');
    await fixture.whenStable();
    const preview = el.querySelector<HTMLInputElement>('.stencil input.preview')!;
    expect(preview.value).toBe('2020 Cars');
    expect(preview.title).toBe('car/2020');
    const input = el.querySelector<HTMLInputElement>('.stencil input.tag-input')!;
    expect(input.classList).toContain('hidden-without-removing');
    preview.dispatchEvent(new Event('focus'));
    await fixture.whenStable();
    expect(field.editing()).toBe(1);
    expect(input.classList).not.toContain('hidden-without-removing');
    expect(preview.style.display).toBe('none');
  });

  it('fills out hierarchical tags top down', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.fields = [
      { key: 'make', type: 'stencil', wrappers: [], props: { template: 'car/<Make>', required: true, hierarchical: true } },
      { key: 'model', type: 'stencil', wrappers: [], props: { template: 'car/<Make>/<Model>', required: true, hierarchical: true, parentKey: 'make', parentTemplate: 'car/<Make>' } },
    ];
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const [make, model] = fixture.debugElement.queryAll(By.directive(FormlyFieldStencil)).map(d => d.componentInstance as FormlyFieldStencil);
    const labels = () => [...el.querySelectorAll('.hierarchical-tag-label')].map(l => l.textContent!.trim());
    const inputs = () => [...el.querySelectorAll<HTMLInputElement>('.stencil input.tag-input')];
    expect(labels()).toEqual(['Cars Make:', 'Cars Model:']);
    expect(el.querySelector('.tag-preview')).toBeNull();
    expect(inputs().map(i => i.disabled)).toEqual([false, true]);
    expect(fixture.componentInstance.form.value).toEqual({ make: 'car', model: null });

    make.setValue(1, 'toyota');
    await fixture.whenStable();
    expect(inputs().map(i => i.disabled)).toEqual([false, false]);
    expect(fixture.componentInstance.form.value).toEqual({ make: 'car/toyota', model: null });
    model.setValue(1, 'prius');
    expect(fixture.componentInstance.form.value).toEqual({ make: 'car/toyota', model: 'car/toyota/prius' });
    expect(fixture.componentInstance.form.valid).toBe(true);

    make.setValue(1, 'honda');
    await fixture.whenStable();
    expect(fixture.componentInstance.form.value).toEqual({ make: 'car/honda', model: null });
    expect(inputs()[1].value).toBe('');
    expect(fixture.componentInstance.form.valid).toBe(false);
  });

  it('is the known prefix and invalid until it is filled out', async () => {
    const { fixture, field } = await render('car/<Year>/<Make>');
    const form = fixture.componentInstance.form;
    expect(form.value).toEqual({ tag: 'car' });
    field.setValue(2, 'toyota');
    expect(form.value).toEqual({ tag: 'car' });
    expect(form.valid).toBe(false);
    field.setValue(1, '2020');
    expect(form.value).toEqual({ tag: 'car/2020/toyota' });
    expect(form.valid).toBe(true);
  });

  it('reads its inputs from the model', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.model = { tag: '_plugin/secret/openai' };
    fixture.componentInstance.fields = [{ key: 'tag', type: 'stencil', props: { template: '+plugin,_plugin/secret/<Secret>' } }];
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector<HTMLSelectElement>('.stencil select')!.value).toBe('_plugin/secret');
    expect(el.querySelector<HTMLInputElement>('.stencil input.tag-input')!.value).toBe('openai');
    expect(fixture.componentInstance.form.value).toEqual({ tag: '_plugin/secret/openai' });
  });

  it('is empty and valid when optional until an input is filled out', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.fields = [{ key: 'tag', type: 'stencil', props: { template: '+plugin,_plugin/secret/<Name>' } }];
    await fixture.whenStable();
    const form = fixture.componentInstance.form;
    const field = fixture.debugElement.query(By.directive(FormlyFieldStencil)).componentInstance as FormlyFieldStencil;
    expect((form.value as any).tag ?? null).toBeNull();
    expect(form.valid).toBe(true);
    field.setValue(0, '_plugin/secret');
    expect((form.value as any).tag ?? null).toBeNull();
    field.setValue(1, 'openai');
    expect(form.value).toEqual({ tag: '_plugin/secret/openai' });
    field.setValue(1, '');
    expect((form.value as any).tag).toBeNull();
    expect(form.valid).toBe(true);
  });

  it('keeps an optional value it cannot fill out until it is edited', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.model = { tag: '+openai/key' };
    fixture.componentInstance.fields = [{ key: 'tag', type: 'stencil', props: { template: '+plugin,_plugin/secret/<Name>' } }];
    await fixture.whenStable();
    expect(fixture.componentInstance.form.value).toEqual({ tag: '+openai/key' });
  });

  it('shows one dropdown with every permutation of the prefix', async () => {
    const { fixture, field, el } = await render('+plugin,_plugin/secret/<Secret>');
    const select = el.querySelector<HTMLSelectElement>('.stencil select')!;
    expect([...select.options].map(o => o.value)).toEqual(['+plugin/secret', '_plugin/secret']);
    expect([...select.options].map(o => o.textContent!.trim())).toEqual(['Secrets (+plugin/secret)', 'Secrets (_plugin/secret)']);
    field.setValue(1, 'openai');
    expect(fixture.componentInstance.form.value).toEqual({ tag: '+plugin/secret/openai' });
    select.value = '_plugin/secret';
    select.dispatchEvent(new Event('change'));
    expect(fixture.componentInstance.form.value).toEqual({ tag: '_plugin/secret/openai' });
  });

  it('only offers prefixes the user can add', async () => {
    canAddTag = tag => !tag?.startsWith('_');
    const { el } = await render('+plugin,_plugin/secret/<Secret>');
    expect(el.querySelector('.stencil select')).toBeNull();
    expect(el.querySelector('.tag-preview')!.getAttribute('title')).toBe('+plugin/secret');
  });

  it('suggests every possibility when filled out of order', async () => {
    const page = vi.spyOn(TestBed.inject(ExtService), 'page').mockReturnValue(of({
      content: [{ tag: 'car/2020', name: '2020' }, { tag: 'car/2020/toyota', name: 'Toyota' }, { tag: 'car/2020/honda/civic', name: 'Civic' }, { tag: 'car/2021/toyota' }],
      page: { number: 0, size: 50, totalElements: 3, totalPages: 1 },
    } as any));
    const { field } = await render('car/<Year>/<Make>');
    vi.useFakeTimers();
    field.search(2);
    vi.advanceTimersByTime(300);
    expect(page).toHaveBeenCalledWith(expect.objectContaining({ query: 'car' }));
    expect(field.autocomplete()).toEqual([{ value: 'toyota', label: 'Toyota' }, { value: 'honda/civic', label: 'Civic' }]);
    vi.useRealTimers();
  });

  it('suggests more than one level for the last input', async () => {
    const page = vi.spyOn(TestBed.inject(ExtService), 'page').mockReturnValue(of({
      content: [{ tag: 'kanban/jasper', name: 'Jasper' }, { tag: 'kanban/jasper/bugs', name: 'Bugs' }],
      page: { number: 0, size: 50, totalElements: 2, totalPages: 1 },
    } as any));
    const { field } = await render('kanban/<Board>');
    vi.useFakeTimers();
    field.search(1);
    vi.advanceTimersByTime(300);
    expect(page).toHaveBeenCalledWith(expect.objectContaining({ query: 'kanban' }));
    expect(field.autocomplete()).toEqual([{ value: 'jasper', label: 'Jasper' }, { value: 'jasper/bugs', label: 'Bugs' }]);
    field.setValue(1, 'jasper/b');
    field.search(1);
    vi.advanceTimersByTime(300);
    expect(page).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'kanban/jasper', search: 'b' }));
    vi.useRealTimers();
  });

  it('does not suggest tags the user cannot add', async () => {
    canAddTag = tag => tag !== 'car/2021';
    vi.spyOn(TestBed.inject(ExtService), 'page').mockReturnValue(of({
      content: [{ tag: 'car/2020' }, { tag: 'car/2021' }],
      page: { number: 0, size: 50, totalElements: 2, totalPages: 1 },
    } as any));
    const { field } = await render('car/<Year>');
    vi.useFakeTimers();
    field.search(1);
    vi.advanceTimersByTime(300);
    expect(field.autocomplete()).toEqual([{ value: '2020', label: '2020' }]);
    vi.useRealTimers();
  });
});
