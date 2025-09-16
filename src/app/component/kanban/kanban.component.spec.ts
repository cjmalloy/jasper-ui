import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { KanbanComponent } from './kanban.component';

describe('KanbanComponent', () => {
  let component: KanbanComponent;
  let fixture: ComponentFixture<KanbanComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [KanbanComponent],
      imports: [RouterModule.forRoot([])],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(KanbanComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('saveChanges navigation guard', () => {
    it('should allow navigation when no columns have pending changes', () => {
      // No column components, should allow navigation
      expect(component.saveChanges()).toBe(true);
    });

    it('should prevent navigation when columns have pending or failed items', () => {
      // Mock column components with pending/failed items
      const mockColumnWithAdding = {
        adding: ['test item'],
        failed: []
      } as any;
      
      const mockColumnWithFailed = {
        adding: [],
        failed: [{ text: 'failed item', error: 'error' }]
      } as any;

      // Test with adding items
      component.list = {
        [Symbol.iterator]: function* () {
          yield mockColumnWithAdding;
        }
      } as any;
      
      expect(component.saveChanges()).toBe(false);

      // Test with failed items
      component.list = {
        [Symbol.iterator]: function* () {
          yield mockColumnWithFailed;
        }
      } as any;
      
      expect(component.saveChanges()).toBe(false);

      // Test with both
      component.list = {
        [Symbol.iterator]: function* () {
          yield mockColumnWithAdding;
          yield mockColumnWithFailed;
        }
      } as any;
      
      expect(component.saveChanges()).toBe(false);
    });
  });
});
