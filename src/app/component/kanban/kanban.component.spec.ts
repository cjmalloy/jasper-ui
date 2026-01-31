import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { KanbanComponent } from './kanban.component';

describe('KanbanComponent', () => {
  let component: KanbanComponent;
  let fixture: ComponentFixture<KanbanComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [forwardRef(() => KanbanComponent)],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
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

      component.list = {
        find: jasmine.createSpy('fn').and.returnValue(undefined) // No column returns false
      } as any;

      expect(component.saveChanges()).toBe(true);
    });

    it('should prevent navigation when any column prevents navigation', () => {
      // Mock column components where one prevents navigation
      const mockColumnAllowing = { saveChanges: () => true } as any;
      const mockColumnPreventing = { saveChanges: () => false } as any;

      component.list = {
        find: jasmine.createSpy('fn').and.returnValue(mockColumnPreventing) // One column returns false
      } as any;

      expect(component.saveChanges()).toBe(false);
    });
  });
});
