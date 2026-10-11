/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { KanbanDrag } from '../kanban.component';

import { KanbanColumnComponent } from './kanban-column.component';

describe('KanbanColumnComponent', () => {
  let component: KanbanColumnComponent;
  let fixture: ComponentFixture<KanbanColumnComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [forwardRef(() => KanbanColumnComponent)],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(KanbanColumnComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('reloads on request changes, preserves cards for search and ignores equal sort arrays', () => {
    const clear = vi.spyOn(component, 'clear').mockImplementation(() => {});
    fixture.componentRef.setInput('query', 'kanban:doing');
    fixture.detectChanges();
    expect(clear).toHaveBeenLastCalledWith(true);
    clear.mockClear();
    fixture.componentRef.setInput('search', 'card');
    fixture.detectChanges();
    expect(clear).toHaveBeenLastCalledWith(false);
    clear.mockClear();
    fixture.componentRef.setInput('sort', []);
    fixture.detectChanges();
    expect(clear).not.toHaveBeenCalled();
    fixture.componentRef.setInput('filter', ['query/done']);
    fixture.detectChanges();
    expect(clear).toHaveBeenLastCalledWith(true);
  });

  it('replaces update subscriptions when the input changes and cleans up on destroy', () => {
    const first = new Subject<KanbanDrag>();
    const second = new Subject<KanbanDrag>();
    const update = vi.spyOn(component, 'update');
    const event = { from: '', to: '', ref: { url: 'comment:card' }, index: 0 };
    fixture.componentRef.setInput('updates', first);
    fixture.detectChanges();
    first.next(event);
    expect(update).toHaveBeenCalledTimes(1);
    fixture.componentRef.setInput('updates', second);
    fixture.detectChanges();
    first.next(event);
    second.next(event);
    expect(update).toHaveBeenCalledTimes(2);
    fixture.destroy();
    expect(second.observed).toBe(false);
  });

  it('updates pagination computations from immutable page writes', () => {
    expect(component.empty()).toBe(true);
    component.page.set({
      content: [{ url: 'comment:card' }],
      page: { number: 0, totalPages: 2, totalElements: 3, size: 1 },
    });
    expect(component.empty()).toBe(false);
    expect(component.more()).toBe(2);
    expect(component.hasMore()).toBe(true);
    component.page.update(page => ({ ...page!, page: { ...page!.page, number: 1 } }));
    expect(component.hasMore()).toBe(false);
  });

  it('matches immutable drag snapshots by composite identity rather than object reference', () => {
    fixture.componentRef.setInput('query', 'kanban:doing');
    const original = { url: 'comment:card', origin: '', tags: ['doing'] };
    component.page.set({
      content: [original],
      page: { number: 0, totalPages: 1, totalElements: 1, size: 8 },
    });
    const previous = component.page();
    component.update({
      from: 'kanban:doing', to: 'kanban:done',
      ref: { ...original, tags: ['done'] }, index: 0,
    });
    expect(component.page()?.content).toEqual([]);
    expect(previous?.content).toEqual([original]);
    expect(original.tags).toEqual(['doing']);
  });

  describe('Recovery Features', () => {
    beforeEach(() => {
      component.failed.set([]);
      component.adding.set([]);
      component.addText.set('');
      vi.spyOn(component, 'add').mockImplementation(() => {});
    });

    it('should track failed items', () => {
      const failedItem = { text: 'Test item', error: 'Network error' };
      component.failed.update(failed => [...failed, failedItem]);

      expect(component.failed().length).toBe(1);
      expect(component.failed()[0]).toEqual(failedItem);
    });

    it('should retry failed items', () => {
      const failedItem = { text: 'Test item', error: 'Network error' };
      component.failed.update(failed => [...failed, failedItem]);

      component.retry(failedItem);

      expect(component.failed().length).toBe(0);
      expect(component.addText()).toBe('Test item');
      expect(component.add).toHaveBeenCalled();
    });

    it('should dismiss failed items', () => {
      const failedItem = { text: 'Test item', error: 'Network error' };
      component.failed.update(failed => [...failed, failedItem]);

      component.dismissFailed(failedItem);

      expect(component.failed().length).toBe(0);
    });

    it('should handle multiple failed items', () => {
      const failedItem1 = { text: 'Test item 1', error: 'Network error' };
      const failedItem2 = { text: 'Test item 2', error: 'Permission denied' };
      component.failed.update(failed => [...failed, failedItem1, failedItem2]);

      expect(component.failed().length).toBe(2);

      component.dismissFailed(failedItem1);
      expect(component.failed().length).toBe(1);
      expect(component.failed()[0]).toEqual(failedItem2);

      component.retry(failedItem2);
      expect(component.failed().length).toBe(0);
      expect(component.addText()).toBe('Test item 2');
    });
  });

  describe('saveChanges navigation guard', () => {
    it('should allow navigation when no pending or failed items exist', () => {
      component.adding.set([]);
      component.failed.set([]);

      expect(component.saveChanges()).toBe(true);
    });

    it('should prevent navigation when items are being added', () => {
      component.adding.set([{ id: 'test-id', name: 'test item' }]);
      component.failed.set([]);

      expect(component.saveChanges()).toBe(false);
    });

    it('should prevent navigation when items have failed', () => {
      component.adding.set([]);
      component.failed.set([{ text: 'failed item', error: 'error' }]);

      expect(component.saveChanges()).toBe(false);
    });

    it('should prevent navigation when both adding and failed items exist', () => {
      component.adding.set([{ id: 'test-id', name: 'adding item' }]);
      component.failed.set([{ text: 'failed item', error: 'error' }]);

      expect(component.saveChanges()).toBe(false);
    });
  });
});
