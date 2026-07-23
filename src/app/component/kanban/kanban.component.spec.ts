/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { RefService } from '../../service/api/ref.service';
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

  it('shows refs pinned to the kanban Ext', () => {
    const refs = TestBed.inject(RefService);
    vi.spyOn(refs, 'getCurrent').mockReturnValue(of({
      url: 'https://example.com/pinned',
      title: 'Pinned card',
    }));
    component.ext = {
      tag: 'kanban/test',
      origin: '',
      config: { pinned: ['https://example.com/pinned'] },
    };

    component.loadPinned();
    fixture.detectChanges();

    expect(component.pinned).toEqual([{
      url: 'https://example.com/pinned',
      title: 'Pinned card',
    }]);
    expect(fixture.nativeElement.querySelectorAll('.kanban-pinned .kanban-card')).toHaveLength(1);
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
        find: vi.fn().mockReturnValue(undefined) // No column returns false
      } as any;

      expect(component.saveChanges()).toBe(true);
    });

    it('should prevent navigation when any column prevents navigation', () => {
      // Mock column components where one prevents navigation
      const mockColumnAllowing = { saveChanges: () => true } as any;
      const mockColumnPreventing = { saveChanges: () => false } as any;

      component.list = {
        find: vi.fn().mockReturnValue(mockColumnPreventing) // One column returns false
      } as any;

      expect(component.saveChanges()).toBe(false);
    });
  });
});
