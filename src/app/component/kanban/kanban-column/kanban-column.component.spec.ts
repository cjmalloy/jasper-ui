/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom, of, Subject } from 'rxjs';
import { AdminService } from '../../../service/admin.service';
import { ProxyService } from '../../../service/api/proxy.service';
import { RefService } from '../../../service/api/ref.service';
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

  function plugins(...tags: string[]) {
    vi.spyOn(TestBed.inject(AdminService), 'getPlugin').mockImplementation(tag => tags.includes(tag) ? { tag } as any : undefined);
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('plugin gating', () => {
    let save: any;
    let create: any;
    const yaml = () => new File(['a: 1'], 'config.yml', { type: '' });
    const bin = () => new File(['x'], 'a.bin', { type: 'application/octet-stream' });

    beforeEach(() => {
      save = vi.spyOn(TestBed.inject(ProxyService), 'save').mockReturnValue(new Subject());
      create = vi.spyOn(TestBed.inject(RefService), 'create').mockReturnValue(of('2024-01-01T00:00:00.000Z'));
    });

    it('uploads code inline when only plugin/code is installed', async () => {
      plugins('plugin/code');
      const ref = await firstValueFrom(component.uploadFile$(yaml(), '1'));
      expect(save).not.toHaveBeenCalled();
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ comment: 'a: 1' }));
      expect(ref!.url).toMatch(/^internal:/);
      expect(ref!.tags).toContain('plugin/code/yaml');
      expect(ref!.comment).toBe('a: 1');
      expect(ref!.modifiedString).toBe('2024-01-01T00:00:00.000Z');
      expect(ref!.modified?.isValid).toBe(true);
      expect(await firstValueFrom(component.uploadFile$(bin(), '2'))).toBeNull();
      expect(save).not.toHaveBeenCalled();
      expect(component.failed()).toEqual([{ text: 'a.bin', error: 'File uploads not enabled' }]);
    });

    it('caches code when only plugin/file is installed', () => {
      plugins('plugin/file');
      component.uploadFile$(yaml(), '1').subscribe();
      expect(save).toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    });

    it('uploads code inline and caches binaries when both plugins are installed', async () => {
      plugins('plugin/code', 'plugin/file');
      const ref = await firstValueFrom(component.uploadFile$(yaml(), '1'));
      expect(ref!.tags).toContain('plugin/code/yaml');
      expect(save).not.toHaveBeenCalled();
      component.uploadFile$(bin(), '2').subscribe();
      expect(save).toHaveBeenCalled();
    });

    it('does not upload when neither plugin is installed', () => {
      plugins();
      component.uploadFiles([yaml()]);
      expect(save).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      expect(component.adding()).toEqual([]);
    });
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
