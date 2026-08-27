/// <reference types="vitest/globals" />
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { Store } from '../store/store';
import { BookmarkService } from './bookmark.service';

describe('BookmarkService', () => {
  let service: BookmarkService;
  let navigate: ReturnType<typeof vi.fn>;
  let view: { filter: string[], viewExtFilter?: string[] };

  beforeEach(async () => {
    navigate = vi.fn();
    view = { filter: [] };
    await TestBed.configureTestingModule({
      providers: [
        BookmarkService,
        { provide: Router, useValue: { navigate } },
        { provide: Store, useValue: { view } },
      ],
    }).compileComponents();

    service = TestBed.inject(BookmarkService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('removes the filter parameter when no defaults are active', () => {
    service.filters = [];

    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: { filter: null, pageNumber: null },
    }));
  });

  it('preserves an empty filter parameter to override active defaults', () => {
    view.viewExtFilter = ['query/public'];

    service.filters = [];

    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: { filter: '', pageNumber: null },
    }));
  });
});
