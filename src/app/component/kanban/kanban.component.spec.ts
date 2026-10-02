/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AccountService } from '../../service/account.service';
import { TaggingService } from '../../service/api/tagging.service';

import { KanbanComponent } from './kanban.component';

describe('KanbanComponent', () => {
  let component: KanbanComponent;
  let fixture: ComponentFixture<KanbanComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KanbanComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(KanbanComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('saveChanges navigation guard', () => {
    it('should allow navigation when no column components exist', () => {
      // No column components, should allow navigation
      expect(component.saveChanges()).toBe(true);
    });

    it('should allow navigation when all columns allow navigation', () => {
      // Mock column components that all allow navigation
      const mockColumn1 = { saveChanges: () => true } as any;
      const mockColumn2 = { saveChanges: () => true } as any;

      vi.spyOn(component, 'list').mockReturnValue([mockColumn1, mockColumn2]);

      expect(component.saveChanges()).toBe(true);
    });

    it('should prevent navigation when any column prevents navigation', () => {
      // Mock column components where one prevents navigation
      const mockColumnAllowing = { saveChanges: () => true } as any;
      const mockColumnPreventing = { saveChanges: () => false } as any;

      vi.spyOn(component, 'list').mockReturnValue([mockColumnAllowing, mockColumnPreventing]);

      expect(component.saveChanges()).toBe(false);
    });

    it('recomputes columns, swim lanes and backlog queries after input changes', () => {
      fixture.componentRef.setInput('ext', {
        tag: 'kanban', origin: '', config: {
          columns: ['doing', 'done'], swimLanes: ['alice', 'bob'],
          showColumnBacklog: true, showSwimLaneBacklog: true,
        },
      });
      fixture.componentRef.setInput('query', 'kanban');
      fixture.detectChanges();
      expect(component.columns()).toEqual(['doing', 'done']);
      expect(component.swimLanes()).toEqual(['alice', 'bob']);
      expect(component.colBacklog()).toBe('!doing:!done');
      expect(component.showColumnBacklog()).toBe(true);
      fixture.componentRef.setInput('query', 'kanban:doing:alice');
      fixture.detectChanges();
      expect(component.columns()).toEqual(['doing']);
      expect(component.swimLanes()).toEqual(['alice']);
      expect(component.showColumnBacklog()).toBe(false);
      fixture.componentRef.setInput('query', 'kanban');
      fixture.componentRef.setInput('filter', ['query/!(doing)']);
      fixture.detectChanges();
      expect(component.columns()).toEqual(['done']);
      fixture.componentRef.setInput('ext', {
        tag: 'kanban', origin: '', config: { columns: ['review'], hideSwimLanes: true, swimLanes: ['alice'] },
      });
      fixture.detectChanges();
      expect(component.columns()).toEqual(['review']);
      expect(component.swimLanes()).toBeUndefined();
      expect(component.andSlBacklog()).toBe('');
    });

    it('emits immutable optimistic drag updates and restores the original ref on failure', () => {
      fixture.componentRef.setInput('query', 'kanban');
      const original = { url: 'comment:card', origin: '', tags: ['doing', 'alice'] };
      const events: any[] = [];
      const subscription = component.updates.subscribe(event => events.push(event));
      vi.spyOn(TestBed.inject(AccountService), 'clearNotificationsIfNone').mockImplementation(() => {});
      const patch = vi.spyOn(TestBed.inject(TaggingService), 'patch').mockReturnValue(of('2026-10-02T00:00:00Z'));
      const drop = {
        item: { data: original },
        previousContainer: { data: { col: 'doing', sl: 'alice' } },
        container: { data: { col: 'done', sl: 'alice' } },
        currentIndex: 0, previousIndex: 0,
      } as any;
      component.drop(drop);
      expect(original.tags).toEqual(['doing', 'alice']);
      expect(events[0].ref).not.toBe(original);
      expect(events[0].ref.tags).toEqual(['alice', 'done']);
      patch.mockReturnValue(throwError(() => new Error('offline')));
      component.drop(drop);
      expect(events.at(-1).ref).toBe(original);
      expect(original.tags).toEqual(['doing', 'alice']);
      subscription.unsubscribe();
    });
  });
});
