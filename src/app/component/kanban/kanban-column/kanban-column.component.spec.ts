import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { KanbanColumnComponent } from './kanban-column.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('KanbanColumnComponent', () => {
  let component: KanbanColumnComponent;
  let fixture: ComponentFixture<KanbanColumnComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([]), KanbanColumnComponent],
    providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
    ]
}).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(KanbanColumnComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Recovery Features', () => {
    beforeEach(() => {
      component.failed = [];
      component.adding = [];
      component.addText = '';
      vi.spyOn(component, 'add');
    });

    it('should track failed items', () => {
      const failedItem = { text: 'Test item', error: 'Network error' };
      component.failed.push(failedItem);

      expect(component.failed.length).toBe(1);
      expect(component.failed[0]).toEqual(failedItem);
    });

    it('should retry failed items', () => {
      const failedItem = { text: 'Test item', error: 'Network error' };
      component.failed.push(failedItem);

      component.retry(failedItem);

      expect(component.failed.length).toBe(0);
      expect(component.addText).toBe('Test item');
      expect(component.add).toHaveBeenCalled();
    });

    it('should dismiss failed items', () => {
      const failedItem = { text: 'Test item', error: 'Network error' };
      component.failed.push(failedItem);

      component.dismissFailed(failedItem);

      expect(component.failed.length).toBe(0);
    });

    it('should handle multiple failed items', () => {
      const failedItem1 = { text: 'Test item 1', error: 'Network error' };
      const failedItem2 = { text: 'Test item 2', error: 'Permission denied' };
      component.failed.push(failedItem1, failedItem2);

      expect(component.failed.length).toBe(2);

      component.dismissFailed(failedItem1);
      expect(component.failed.length).toBe(1);
      expect(component.failed[0]).toEqual(failedItem2);

      component.retry(failedItem2);
      expect(component.failed.length).toBe(0);
      expect(component.addText).toBe('Test item 2');
    });
  });

  describe('saveChanges navigation guard', () => {
    it('should allow navigation when no pending or failed items exist', () => {
      component.adding = [];
      component.failed = [];

      expect(component.saveChanges()).toBe(true);
    });

    it('should prevent navigation when items are being added', () => {
      component.adding = ['test item'];
      component.failed = [];

      expect(component.saveChanges()).toBe(false);
    });

    it('should prevent navigation when items have failed', () => {
      component.adding = [];
      component.failed = [{ text: 'failed item', error: 'error' }];

      expect(component.saveChanges()).toBe(false);
    });

    it('should prevent navigation when both adding and failed items exist', () => {
      component.adding = ['adding item'];
      component.failed = [{ text: 'failed item', error: 'error' }];

      expect(component.saveChanges()).toBe(false);
    });
  });
});
