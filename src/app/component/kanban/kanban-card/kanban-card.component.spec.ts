/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { KanbanCardComponent } from './kanban-card.component';

describe('KanbanCardComponent', () => {
  let component: KanbanCardComponent;
  let fixture: ComponentFixture<KanbanCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [forwardRef(() => KanbanCardComponent)],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(KanbanCardComponent);
    component = fixture.componentInstance;
    component.ref = {url: ''};
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it.each([false, true])('only restores selected-card scrolling on Back (%s)', restore => {
    vi.useFakeTimers();
    const scroll = fixture.nativeElement.scrollIntoView = vi.fn();
    try {
      component.store.view.setLastSelected(component.ref);
      component.store.view.restoreLastSelectedScroll = restore;
      component.ngAfterViewInit();
      vi.advanceTimersByTime(400);

      expect(component.lastSelected).toBe(true);
      expect(scroll).toHaveBeenCalledTimes(restore ? 1 : 0);
    } finally {
      vi.useRealTimers();
    }
  });
});
