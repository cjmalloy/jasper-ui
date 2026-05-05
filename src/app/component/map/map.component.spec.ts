/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { MapComponent } from './map.component';

describe('MapComponent', () => {
  let component: MapComponent;
  let fixture: ComponentFixture<MapComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [forwardRef(() => MapComponent)],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents()

    fixture = TestBed.createComponent(MapComponent);
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

  describe('page', () => {
    it('should fetch source refs for bare repost map data', () => {
      const repostRef: Ref = {
        url: 'tag:/repost/1',
        origin: '',
        tags: ['plugin/repost'],
        sources: ['https://example.com/original'],
      };
      const sourceRef: Ref = {
        url: 'https://example.com/original',
        origin: '',
        tags: ['plugin/geo', 'plugin/geo/point'],
        title: 'Original title',
        sources: ['https://example.com/source-source'],
        plugins: {
          'plugin/geo/point': {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [1, 2] },
            properties: {},
          },
        },
      };

      component.page = Page.of([repostRef]);

      const req = http.expectOne(request =>
        request.url.endsWith('/api/v1/ref/page')
        && request.params.get('url') === sourceRef.url
        && request.params.get('size') === '1'
      );
      req.flush(Page.of([sourceRef]));

      expect(component.mapData).toEqual([[
        expect.objectContaining({
          url: repostRef.url,
          title: sourceRef.title,
          sources: sourceRef.sources,
        }),
        repostRef,
      ]]);
    });

    it('should keep repost geo data when resolving a bare repost source ref', () => {
      const repostPoint = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [1, 2] },
        properties: {},
      };
      const sourcePoint = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [3, 4] },
        properties: {},
      };
      const repostRef: Ref = {
        url: 'tag:/repost/1',
        origin: '',
        tags: ['plugin/repost', 'plugin/geo', 'plugin/geo/point'],
        sources: ['https://example.com/original'],
        plugins: {
          'plugin/geo/point': repostPoint,
        },
      };
      const sourceRef: Ref = {
        url: 'https://example.com/original',
        origin: '',
        tags: ['plugin/geo', 'plugin/geo/point', 'plugin/geo/polygon', 'article'],
        title: 'Original title',
        plugins: {
          'plugin/geo/point': sourcePoint,
          'plugin/thumbnail': { emoji: '🗺️' },
        },
      };

      component.page = Page.of([repostRef]);

      const req = http.expectOne(request =>
        request.url.endsWith('/api/v1/ref/page')
        && request.params.get('url') === sourceRef.url
      );
      req.flush(Page.of([sourceRef]));

      const [ref, bareRepost] = component.mapData[0];
      expect(ref).toEqual(expect.objectContaining({
        url: repostRef.url,
        title: sourceRef.title,
      }));
      expect(bareRepost).toBe(repostRef);
      expect(ref.tags).toEqual(expect.arrayContaining(['article', 'plugin/geo', 'plugin/geo/point']));
      expect(ref.tags).not.toContain('plugin/geo/polygon');
      expect(ref.plugins?.['plugin/geo/point']).toBe(repostPoint);
      expect(ref.plugins?.['plugin/thumbnail']).toEqual(sourceRef.plugins!['plugin/thumbnail']);
    });

    it('should keep non-bare repost map entries unchanged', () => {
      const repostRef: Ref = {
        url: 'tag:/repost/1',
        origin: '',
        tags: ['plugin/repost', 'plugin/geo', 'plugin/geo/point'],
        sources: ['https://example.com/original'],
        title: 'Repost title',
        plugins: {
          'plugin/geo/point': {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [1, 2] },
            properties: {},
          },
        },
      };

      component.page = Page.of([repostRef]);

      expect(component.mapData).toEqual([[repostRef]]);
    });

    it('should cancel previous bare repost source fetches when page changes', () => {
      const firstRepost: Ref = {
        url: 'tag:/repost/1',
        origin: '',
        tags: ['plugin/repost'],
        sources: ['https://example.com/first'],
      };
      const secondRepost: Ref = {
        url: 'tag:/repost/2',
        origin: '',
        tags: ['plugin/repost'],
        sources: ['https://example.com/second'],
      };
      const secondSource: Ref = {
        url: 'https://example.com/second',
        origin: '',
        tags: ['plugin/geo', 'plugin/geo/point'],
        title: 'Second original',
        plugins: {
          'plugin/geo/point': {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [3, 4] },
            properties: {},
          },
        },
      };

      component.page = Page.of([firstRepost]);
      const firstReq = http.expectOne(request =>
        request.url.endsWith('/api/v1/ref/page')
        && request.params.get('url') === firstRepost.sources![0]
      );

      component.page = Page.of([secondRepost]);

      expect(firstReq.cancelled).toBe(true);
      const secondReq = http.expectOne(request =>
        request.url.endsWith('/api/v1/ref/page')
        && request.params.get('url') === secondRepost.sources![0]
      );
      secondReq.flush(Page.of([secondSource]));

      expect(component.mapData).toEqual([[
        expect.objectContaining({
          url: secondRepost.url,
          title: secondSource.title,
        }),
        secondRepost,
      ]]);
      expect(component.mapData.some(([ref]) => ref.url === firstRepost.sources![0])).toBe(false);
    });
  });
});
