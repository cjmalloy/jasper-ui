/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { DateTime } from 'luxon';
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
      published: expect.any(DateTime),
      plugins: {
        '+plugin/origin': { remote: '', local: '@example' },
      },
    }));
  });
});
