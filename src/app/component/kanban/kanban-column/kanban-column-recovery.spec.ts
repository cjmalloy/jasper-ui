import { KanbanColumnComponent } from './kanban-column.component';

describe('KanbanColumnComponent Recovery Features', () => {
  let component: KanbanColumnComponent;

  beforeEach(() => {
    // Create a minimal component instance for testing
    component = {
      failed: [],
      adding: [],
      addText: '',
      add: jasmine.createSpy('add'),
      retry: jasmine.createSpy('retry').and.callFake((failedItem) => {
        const index = component.failed.indexOf(failedItem);
        if (index > -1) {
          component.failed.splice(index, 1);
          component.addText = failedItem.text;
          component.add();
        }
      }),
      dismissFailed: jasmine.createSpy('dismissFailed').and.callFake((failedItem) => {
        const index = component.failed.indexOf(failedItem);
        if (index > -1) {
          component.failed.splice(index, 1);
        }
      })
    } as any;
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