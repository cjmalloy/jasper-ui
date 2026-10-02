/// <reference types="vitest/globals" />
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { Store } from '../store/store';

import { BookmarkService } from './bookmark.service';

describe('BookmarkService', () => {
  let service: BookmarkService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
      ],
    }).compileComponents();

    service = TestBed.inject(BookmarkService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

describe('BookmarkService signals', () => {
    it('updates derived filters without replacing the service', () => {
      const filters = signal<string[]>([]);
      TestBed.configureTestingModule({
        providers: [
          BookmarkService,
          { provide: Store, useValue: { view: { filter: filters } } },
          { provide: Router, useValue: { navigate: vi.fn() } },
        ],
      });
      const service = TestBed.inject(BookmarkService);
      expect(service.filters()).toEqual([]);
      filters.set(['query/public']);
      expect(service.filters()).toEqual(['query/public']);
    });

    it('toggles tags without mutating the submit store snapshot', () => {
      const original = ['alpha', 'alpha/child', 'beta'];
      const tags = signal(original);
      const navigate = vi.fn();
      TestBed.configureTestingModule({
        providers: [
          BookmarkService,
          { provide: Store, useValue: { submit: { tags } } },
          { provide: Router, useValue: { navigate } },
        ],
      });
      TestBed.inject(BookmarkService).toggleTag('alpha');
      expect(original).toEqual(['alpha', 'alpha/child', 'beta']);
      expect(tags()).toBe(original);
      expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
        queryParams: { tag: ['beta'], pageNumber: null },
      }));
    });
});
