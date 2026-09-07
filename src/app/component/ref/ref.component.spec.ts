/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SafePipe } from '../../pipe/safe.pipe';

import { RefComponent } from './ref.component';

describe('RefComponent', () => {
  let component: RefComponent;
  let fixture: ComponentFixture<RefComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        forwardRef(() => RefComponent),
        ReactiveFormsModule,
        SafePipe,
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RefComponent);
    component = fixture.componentInstance;
    component.ref = { url: '' };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it.each([false, true])('only scrolls to the selected Ref when restoring Back navigation (%s)', restore => {
    vi.useFakeTimers();
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    try {
      component.ref = { url: 'https://example.com/selected' };
      component.scrollToLatest = true;
      component.store.view.setLastSelected(component.ref);
      component.store.view.restoreLastSelectedScroll = restore;

      component.ngAfterViewInit();
      vi.advanceTimersByTime(400);

      expect(component.lastSelected).toBe(true);
      expect(scroll).toHaveBeenCalledTimes(restore ? 1 : 0);
    } finally {
      scroll.mockRestore();
      vi.useRealTimers();
    }
  });

  it('does not run a pending selected-item scroll after forward navigation', () => {
    vi.useFakeTimers();
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    try {
      component.ref = { url: 'https://example.com/selected' };
      component.scrollToLatest = true;
      component.store.view.setLastSelected(component.ref);
      component.store.view.restoreLastSelectedScroll = true;
      component.ngAfterViewInit();

      component.store.view.restoreLastSelectedScroll = false;
      vi.advanceTimersByTime(400);

      expect(scroll).not.toHaveBeenCalled();
    } finally {
      scroll.mockRestore();
      vi.useRealTimers();
    }
  });

  it('keeps the disabled Ref URL in thumbnail data while editing', () => {
    component.ref = { url: 'cache:image-id', origin: '' };
    component.editForm.get('url')!.setValue(component.ref.url);
    (component as any)._editing = true;

    expect(component.thumbnailRefs[0]?.url).toBe('cache:image-id');
  });

  it('preserves protected and private plugin tags when copying', () => {
    component.ref = {
      url: 'https://example.com',
      origin: '@remote',
      tags: ['public', '+restricted', '_private', '+plugin/secret', '_plugin/cache'],
      plugins: {
        '+plugin/secret': { value: 'secret' },
        '_plugin/cache': { value: 'cached' },
      },
    };
    const refs = (component as any).refs;
    const auth = (component as any).auth;
    vi.spyOn(auth, 'canAddTag').mockReturnValue(true);
    const create = vi.spyOn(refs, 'create').mockReturnValue(of(component.ref));

    component.copy$();

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      tags: ['public', '+plugin/secret', '_plugin/cache'],
      plugins: {
        '+plugin/secret': { value: 'secret' },
        '_plugin/cache': { value: 'cached' },
      },
    }));
  });
});
