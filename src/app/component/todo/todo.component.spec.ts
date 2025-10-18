import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { TodoComponent } from './todo.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { MergeRegion } from 'node-diff3';

describe('TodoComponent', () => {
  let component: TodoComponent;
  let fixture: ComponentFixture<TodoComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
    declarations: [TodoComponent],
    imports: [RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    fixture = TestBed.createComponent(TodoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Merge Conflict Auto-Resolution', () => {
    it('should auto-resolve when both users add different tasks', () => {
      const conflict: MergeRegion<string>[] = [
        { ok: ['- [ ] Task 1', '- [ ] Task 2'] },
        { 
          conflict: { 
            b: ['- [ ] Task from user A'], 
            bIndex: 2,
            a: ['- [ ] Task from user B'],
            aIndex: 2,
            o: [],
            oIndex: 2
          } 
        }
      ];

      const result = (component as any).tryAutoResolveTodoConflict(conflict, '- [ ] Task 1\n- [ ] Task 2\n- [ ] Task from user B');

      expect(result.stillHasConflict).toBe(false);
      expect(result.mergedComment).toContain('Task from user A');
      expect(result.mergedComment).toContain('Task from user B');
      expect(result.mergedComment).toContain('Task 1');
      expect(result.mergedComment).toContain('Task 2');
    });

    it('should not auto-resolve when conflict has non-task content', () => {
      const conflict: MergeRegion<string>[] = [
        { ok: ['- [ ] Task 1'] },
        { 
          conflict: { 
            b: ['Some random text'], 
            bIndex: 1,
            a: ['- [ ] Task from user B'],
            aIndex: 1,
            o: [],
            oIndex: 1
          } 
        }
      ];

      const result = (component as any).tryAutoResolveTodoConflict(conflict, '- [ ] Task 1\n- [ ] Task from user B');

      expect(result.stillHasConflict).toBe(true);
      expect(result.mergedComment).toBeNull();
    });

    it('should handle multiple conflict regions with all tasks', () => {
      const conflict: MergeRegion<string>[] = [
        { ok: ['- [ ] Task 1'] },
        { 
          conflict: { 
            b: ['- [ ] Task A1', '- [ ] Task A2'], 
            bIndex: 1,
            a: ['- [ ] Task B1'],
            aIndex: 1,
            o: [],
            oIndex: 1
          } 
        },
        { ok: ['- [ ] Task 2'] },
        { 
          conflict: { 
            b: ['- [ ] Task A3'], 
            bIndex: 2,
            a: ['- [ ] Task B2', '- [ ] Task B3'],
            aIndex: 2,
            o: [],
            oIndex: 2
          } 
        }
      ];

      const result = (component as any).tryAutoResolveTodoConflict(conflict, 'irrelevant');

      expect(result.stillHasConflict).toBe(false);
      expect(result.mergedComment).toContain('Task A1');
      expect(result.mergedComment).toContain('Task A2');
      expect(result.mergedComment).toContain('Task A3');
      expect(result.mergedComment).toContain('Task B1');
      expect(result.mergedComment).toContain('Task B2');
      expect(result.mergedComment).toContain('Task B3');
    });

    it('should handle empty conflict arrays', () => {
      const conflict: MergeRegion<string>[] = [
        { ok: ['- [ ] Task 1'] },
        { 
          conflict: { 
            b: [], 
            bIndex: 1,
            a: ['- [ ] Task B'],
            aIndex: 1,
            o: [],
            oIndex: 1
          } 
        }
      ];

      const result = (component as any).tryAutoResolveTodoConflict(conflict, '- [ ] Task 1\n- [ ] Task B');

      expect(result.stillHasConflict).toBe(false);
      expect(result.mergedComment).toContain('Task 1');
      expect(result.mergedComment).toContain('Task B');
    });

    it('should stop processing at first unresolvable conflict', () => {
      const conflict: MergeRegion<string>[] = [
        { ok: ['- [ ] Task 1'] },
        { 
          conflict: { 
            b: ['- [ ] Task A'], 
            bIndex: 1,
            a: ['- [ ] Task B'],
            aIndex: 1,
            o: [],
            oIndex: 1
          } 
        },
        { 
          conflict: { 
            b: ['Not a task'], 
            bIndex: 2,
            a: ['- [ ] Task C'],
            aIndex: 2,
            o: [],
            oIndex: 2
          } 
        },
        { ok: ['- [ ] Task 4'] }
      ];

      const result = (component as any).tryAutoResolveTodoConflict(conflict, 'irrelevant');

      expect(result.stillHasConflict).toBe(true);
      expect(result.mergedComment).toBeNull();
    });
  });
});
