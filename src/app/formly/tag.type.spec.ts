/// <reference types="vitest/globals" />
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { FormlyConfig } from '@ngx-formly/core';
import { of } from 'rxjs';
import { AdminService } from '../service/admin.service';
import { ExtService } from '../service/api/ext.service';
import { ConfigService } from '../service/config.service';
import { EditorService } from '../service/editor.service';
import { Store } from '../store/store';
import { FormlyFieldTagInput } from './tag.type';

describe('FormlyFieldTagInput', () => {
  let component: FormlyFieldTagInput;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ConfigService, useValue: {} },
        { provide: FormlyConfig, useValue: {} },
        { provide: AdminService, useValue: {} },
        { provide: EditorService, useValue: {} },
        { provide: ExtService, useValue: {} },
        { provide: Store, useValue: {} },
      ],
    });
    component = TestBed.runInInjectionContext(() => new FormlyFieldTagInput());
    component.field = {
      type: 'selector',
      formControl: new FormControl(''),
      props: {},
      options: { showError: () => false },
    };
  });

  it.each(['selector', 'tagOriginSelector'])('shows the origin after the %s preview', type => {
    component.field.type = type;
    vi.spyOn(component, 'preview$').mockReturnValue(of({ name: 'Science', tag: 'science' }));

    component.getPreview('science@home');

    expect(component.preview()).toBe('Science @home');
    expect(component.previewTitle()).toBe('science@home');
  });

  it.each([
    ['science@home', 'science @home'],
    ['science@', 'science @'],
    ['@home', '@home'],
  ])('falls back to the selector value %s when there is no preview', (value, preview) => {
    vi.spyOn(component, 'preview$').mockReturnValue(of(undefined));

    component.getPreview(value);

    expect(component.preview()).toBe(preview);
  });

  it.each([
    ['selector', 'science'],
    ['tag', 'science@home'],
  ])('keeps the existing preview for %s with value %s', (type, value) => {
    component.field.type = type;
    vi.spyOn(component, 'preview$').mockReturnValue(of({ name: 'Science', tag: 'science' }));

    component.getPreview(value);

    expect(component.preview()).toBe('Science');
  });
});
