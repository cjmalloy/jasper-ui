/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';

import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { PLAYLIST_PAGE_SIZE, PlaylistComponent } from './playlist.component';

describe('PlaylistComponent', () => {
  let component: PlaylistComponent;
  let fixture: ComponentFixture<PlaylistComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        forwardRef(() => PlaylistComponent),
        MarkdownModule.forRoot(),
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PlaylistComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads every page with a bounded page size', () => {
    const urls = Array.from({ length: PLAYLIST_PAGE_SIZE + 1 }, (_, i) => `https://example.com/${i}`);
    const refs = urls.map(url => ({ url, origin: '' }));
    setPlaylist({ url: 'tag:/playlist', origin: '', sources: urls });

    request(0, PLAYLIST_PAGE_SIZE).flush(page(refs.slice(0, PLAYLIST_PAGE_SIZE), 0, PLAYLIST_PAGE_SIZE, refs.length));
    request(1, PLAYLIST_PAGE_SIZE).flush(page(refs.slice(PLAYLIST_PAGE_SIZE), 1, PLAYLIST_PAGE_SIZE, refs.length));

    expect(component.sources()?.content).toEqual(refs);
  });

  it('halves failed page sizes and skips a page that fails at size one', () => {
    const urls = ['https://example.com/broken', 'https://example.com/working'];
    const working = { url: urls[1], origin: '' };
    setPlaylist({ url: 'tag:/playlist', origin: '', sources: urls });

    for (let size = PLAYLIST_PAGE_SIZE; size > 1; size = Math.max(1, Math.floor(size / 2))) {
      request(0, size).flush('server error', { status: 500, statusText: 'Server Error' });
    }
    request(0, 1).flush('server error', { status: 500, statusText: 'Server Error' });
    request(1, 1).flush(page([working], 1, 1, urls.length));

    expect(component.sources()?.content).toEqual([working]);
  });

  it('cancels requests when the playlist changes and on destroy', () => {
    setPlaylist({ url: 'tag:/first', origin: '', sources: ['https://example.com/first'] });
    const first = request(0, PLAYLIST_PAGE_SIZE, 'tag:/first');

    setPlaylist({ url: 'tag:/second', origin: '', sources: ['https://example.com/second'] });

    expect(first.cancelled).toBe(true);
    const second = request(0, PLAYLIST_PAGE_SIZE, 'tag:/second');
    fixture.destroy();
    expect(second.cancelled).toBe(true);
  });

  function setPlaylist(ref: Ref) {
    fixture.componentRef.setInput('ref', ref);
    fixture.detectChanges();
  }

  function request(pageNumber: number, size: number, source = 'tag:/playlist'): TestRequest {
    return http.expectOne(req =>
      req.url.endsWith('/api/v1/ref/page')
      && req.params.get('sources') === source
      && req.params.get('page') === (pageNumber ? `${pageNumber}` : null)
      && req.params.get('size') === `${size}`
    );
  }

  function page(content: Ref[], number: number, size: number, totalElements: number): Page<Ref> {
    return {
      content,
      page: {
        number,
        size,
        totalElements,
        totalPages: Math.ceil(totalElements / size),
      },
    };
  }
});
