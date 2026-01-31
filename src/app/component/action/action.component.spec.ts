import { ActionComponent } from './action.component';

describe('ActionComponent', () => {
  let component: ActionComponent;

  beforeEach(() => {
    component = new ActionComponent();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have reset method', () => {
    expect(component.reset).toBeDefined();
    expect(typeof component.reset).toBe('function');
  });

  it('should have active method that returns false by default', () => {
    expect(component.active).toBeDefined();
    expect(typeof component.active).toBe('function');
    expect(component.active()).toBe(false);
  });

  it('reset should not throw', () => {
    expect(() => component.reset()).not.toThrow();
  });
});
