/// <reference types="vitest/globals" />
import { HttpErrorResponse, provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

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

  it('accepts torrent files in the standard file picker', () => {
    const input = fixture.nativeElement.querySelector('input[type="file"]');

    expect(input.accept.split(',')).toContain('.torrent');
  });

  it('reports torrent cache failures and clears upload progress', async () => {
    const file = new File(
      [new TextEncoder().encode('d4:infod6:lengthi1e4:name4:testee')],
      'test.torrent',
      { type: 'application/x-bittorrent' },
    );
    component.store.submit.caching.set(file, { name: file.name, progress: 50 });
    vi.spyOn(component['proxy'], 'save').mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 500,
      statusText: 'Cache failed',
    })));

    component.readTorrent([file]);

    await vi.waitFor(() => {
      expect(component.serverErrors).not.toHaveLength(0);
      expect(component.store.submit.caching.has(file)).toBe(false);
    });
  });

  it('reports invalid torrent data and clears upload progress', async () => {
    const file = new File(['invalid'], 'invalid.torrent', { type: 'application/x-bittorrent' });
    component.store.submit.caching.set(file, { name: file.name, progress: 0 });

    component.readTorrent([file]);

    await vi.waitFor(() => {
      expect(component.serverErrors).not.toHaveLength(0);
      expect(component.store.submit.caching.has(file)).toBe(false);
    });
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
});
