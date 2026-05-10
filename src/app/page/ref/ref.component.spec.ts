/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { RefPage } from './ref.component';

describe('RefPage', () => {
  let component: RefPage;
  let fixture: ComponentFixture<RefPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [forwardRef(() => RefPage)],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RefPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load the ref for an explicit route origin', () => {
    const remoteRef = {
      url: 'https://example.com/ref',
      origin: '@remote',
      tags: [],
    };
    const store = {
      view: {
        url: remoteRef.url,
        origin: remoteRef.origin,
        ref: undefined,
        versions: 0,
        setRef: vi.fn(),
        clear: vi.fn(),
      },
    };
    const refs = {
      count: vi.fn(() => of(0)),
      get: vi.fn(() => of(remoteRef)),
      getCurrent: vi.fn(),
    };

    const directComponent = new RefPage(
      { websockets: false } as any,
      { getPlugin: vi.fn() } as any,
      store as any,
      refs as any,
      {} as any,
      {} as any,
      {} as any,
    );

    directComponent.reload(remoteRef.url, remoteRef.origin);

    expect(refs.get).toHaveBeenCalledWith(remoteRef.url, remoteRef.origin);
    expect(refs.getCurrent).not.toHaveBeenCalled();
    expect(store.view.setRef).toHaveBeenCalledWith(remoteRef, undefined);
  });
});
