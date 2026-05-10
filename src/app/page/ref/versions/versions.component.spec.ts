/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { RefVersionsComponent } from './versions.component';

describe('RefVersionsComponent', () => {
  let component: RefVersionsComponent;
  let fixture: ComponentFixture<RefVersionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [forwardRef(() => RefVersionsComponent)],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RefVersionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should include current and obsolete refs in version results', () => {
    const mod = { setTitle: vi.fn() };
    const store = {
      view: {
        defaultSort: [],
        sort: ['published'],
        filter: [],
        search: '',
        pageNumber: 0,
        pageSize: 24,
        url: 'https://example.com/ref',
        ref: {
          url: 'https://example.com/ref',
          origin: '@remote',
        },
      },
    };
    const query = {
      clear: vi.fn(),
      close: vi.fn(),
      setArgs: vi.fn(),
    };

    vi.useFakeTimers();
    const directComponent = new RefVersionsComponent(mod as any, {} as any, store as any, query as any);
    directComponent.ngOnInit();
    vi.runOnlyPendingTimers();

    expect(query.setArgs).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://example.com/ref',
      obsolete: null,
    }));

    directComponent.ngOnDestroy();
    vi.useRealTimers();
  });
});
