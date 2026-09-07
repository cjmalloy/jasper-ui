/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CommentComponent } from './comment.component';

describe('CommentComponent', () => {
  let component: CommentComponent;
  let fixture: ComponentFixture<CommentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [forwardRef(() => CommentComponent)],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CommentComponent);
    component = fixture.componentInstance;
    component.ref = { url: '' };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it.each([false, true])('only restores selected-comment scrolling on Back (%s)', restore => {
    vi.useFakeTimers();
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    try {
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
});
