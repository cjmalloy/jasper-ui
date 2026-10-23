/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { UploadPage } from './upload.component';

describe('UploadPage', () => {
  let component: UploadPage;
  let fixture: ComponentFixture<UploadPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [forwardRef(() => UploadPage)],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({}),
            queryParams: of({}),
            snapshot: { params: {}, queryParams: {} }
          }
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UploadPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('preserves origin plugin data and supplies a missing published date', () => {
    const refs = component['refs'];
    vi.spyOn(component['auth'], 'canAddTag').mockReturnValue(true);
    const create = vi.spyOn(refs, 'create').mockReturnValue(of('cursor'));

    component.uploadRef$({
      url: 'https://example.com',
      tags: ['public', '+plugin/origin/pull'],
      plugins: {
        '+plugin/origin': { remote: '', local: '@example' },
      },
    }).subscribe();

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      published: expect.anything(),
      plugins: {
        '+plugin/origin': { remote: '', local: '@example' },
      },
    }));
  });

  it('adds the user signature to uploaded refs', () => {
    const refs = component['refs'];
    component.store.account.tag.set('+user/alice');
    vi.spyOn(component['auth'], 'canAddTag').mockReturnValue(true);
    const create = vi.spyOn(refs, 'create').mockReturnValue(of('cursor'));

    component.uploadRef$({
      url: 'https://example.com',
      tags: ['_private'],
    }).subscribe();

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      tags: ['_private', '+user/alice'],
    }));
  });

  it('reads dropped YAML files as inline code', () => {
    const readData = vi.spyOn(component, 'readData');
    const readCache = vi.spyOn(component, 'readCache').mockImplementation(() => {});
    const file = new File(['a: 1'], 'config.yml', { type: '' });
    component.readUploads([file]);
    expect(readData).toHaveBeenCalledWith([file], 'plugin/code/yaml', expect.anything());
    expect(readCache).toHaveBeenCalledWith([], 'plugin/file', expect.anything());
  });

  it('caches YAML files when the cache button is used', () => {
    const readData = vi.spyOn(component, 'readData');
    const readCache = vi.spyOn(component, 'readCache').mockImplementation(() => {});
    const file = new File(['a: 1'], 'config.yml', { type: '' });
    component.readUploads([file], true);
    expect(readData).toHaveBeenCalledWith([], 'plugin/code/yaml', expect.anything());
    expect(readCache).toHaveBeenCalledWith([file], 'plugin/file', expect.anything());
  });
});
