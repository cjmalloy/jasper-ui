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

      expect(component.mapData).toEqual([expect.objectContaining({
        url: sourceRef.url,
        title: sourceRef.title,
      })]);
      expect((component as any).mapLinkUrl(component.mapData[0])).toBe(repostRef.url);
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

      expect(component.mapData[0]).toEqual(expect.objectContaining({
        url: sourceRef.url,
        title: sourceRef.title,
      }));
      expect(component.mapData[0].tags).toEqual(expect.arrayContaining(['article', 'plugin/geo', 'plugin/geo/point']));
      expect(component.mapData[0].tags).not.toContain('plugin/geo/polygon');
      expect(component.mapData[0].plugins?.['plugin/geo/point']).toBe(repostPoint);
      expect(component.mapData[0].plugins?.['plugin/thumbnail']).toEqual(sourceRef.plugins!['plugin/thumbnail']);
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

      expect(component.mapData).toEqual([expect.objectContaining({
        url: secondSource.url,
        title: secondSource.title,
      })]);
      expect(component.mapData.some(ref => ref.url === firstRepost.sources![0])).toBe(false);
    });
  });
});
