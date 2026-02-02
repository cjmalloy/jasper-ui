/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef, inputBinding, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { KanbanColumnComponent } from './kanban-column/kanban-column.component';

import { KanbanComponent } from './kanban.component';

describe('KanbanComponent', () => {
  let listSignal = signal<KanbanColumnComponent>([] as any);
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

    listSignal.set([] as any);
    fixture = TestBed.createComponent(KanbanComponent, {
      bindings: [inputBinding('list', () => listSignal)],
    });
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

      expect(component.saveChanges()).toBe(true);
    });

    it('should prevent navigation when any column prevents navigation', () => {
      // Mock column components where one prevents navigation
      const mockColumnAllowing = { saveChanges: () => true } as any;
      const mockColumnPreventing = { saveChanges: () => false } as any;

      listSignal.set(mockColumnPreventing) // One column returns false

      expect(component.saveChanges()).toBe(false);
    });
  });
});
