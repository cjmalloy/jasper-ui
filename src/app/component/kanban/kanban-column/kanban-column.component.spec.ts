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
    declarations: [KanbanColumnComponent],
    imports: [RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
})
    .compileComponents();
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
      spyOn(component, 'add');
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
});
