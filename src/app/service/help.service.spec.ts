/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HelpService } from './help.service';
import { Store } from '../store/store';
import { AdminService } from './admin.service';

describe('HelpService', () => {
  let service: HelpService;
  let store: Store;
  let adminService: AdminService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ]
    }).compileComponents();
    
    service = TestBed.inject(HelpService);
    store = TestBed.inject(Store);
    adminService = TestBed.inject(AdminService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('endTour behavior', () => {
    let mockElement1: HTMLElement;
    let mockElement2: HTMLElement;
    let mockElement3: HTMLElement;

    beforeEach(() => {
      // Create mock elements
      mockElement1 = document.createElement('div');
      mockElement2 = document.createElement('div');
      mockElement3 = document.createElement('div');
      document.body.appendChild(mockElement1);
      document.body.appendChild(mockElement2);
      document.body.appendChild(mockElement3);

      // Mock admin service to return true for config/help
      vi.spyOn(adminService, 'getTemplate').mockReturnValue({} as any);
      
      // Clear localStorage
      localStorage.clear();
    });

    afterEach(() => {
      // Cleanup
      document.body.removeChild(mockElement1);
      document.body.removeChild(mockElement2);
      document.body.removeChild(mockElement3);
      localStorage.clear();
    });

    it('should preserve undisplayed steps after endTour on first step', async () => {
      // Add three steps
      await service.pushStep(mockElement1, 'Step 1');
      await service.pushStep(mockElement2, 'Step 2');
      await service.pushStep(mockElement3, 'Step 3');

      // Wait for tour to start and show first step
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Verify we're on the first step
      expect(store.helpStepIndex).toBe(0);
      expect(store.helpSteps).toBe(3);

      // End tour while on first step (simulating backdrop click)
      service.endTour();

      // Verify: step 0 dismissed, steps 1 and 2 remain
      expect(store.helpStepIndex).toBe(-1);
      expect(store.helpSteps).toBe(2); // Two steps remain
    });

    it('should dismiss shown steps and preserve undisplayed steps after navigating forward', async () => {
      // Add three steps
      await service.pushStep(mockElement1, 'Step 1');
      await service.pushStep(mockElement2, 'Step 2');
      await service.pushStep(mockElement3, 'Step 3');

      // Wait for tour to start
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Navigate to second step
      service.nextStep();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify we're on the second step
      expect(store.helpStepIndex).toBe(1);

      // End tour while on second step
      service.endTour();

      // Verify: steps 0 and 1 dismissed, step 2 remains
      expect(store.helpStepIndex).toBe(-1);
      expect(store.helpSteps).toBe(1); // One step remains
    });

    it('should track maxIndexReached correctly when using Previous button', async () => {
      // Add three steps
      await service.pushStep(mockElement1, 'Step 1');
      await service.pushStep(mockElement2, 'Step 2');
      await service.pushStep(mockElement3, 'Step 3');

      // Wait for tour to start
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Navigate forward twice
      service.nextStep();
      await new Promise(resolve => setTimeout(resolve, 100));
      service.nextStep();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Now on step 2 (index 2)
      expect(store.helpStepIndex).toBe(2);

      // Navigate back to step 1
      service.previousStep();
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(store.helpStepIndex).toBe(1);

      // End tour while on step 1 (but we've seen step 2)
      service.endTour();

      // Verify: all steps were shown (maxIndexReached was 2), so no steps remain
      expect(store.helpStepIndex).toBe(-1);
      expect(store.helpSteps).toBe(0); // No steps remain
    });

    it('should reset maxIndexReached when starting a new tour', async () => {
      // Add and complete first tour
      await service.pushStep(mockElement1, 'Step 1');
      await new Promise(resolve => setTimeout(resolve, 1100));
      service.nextStep();

      // Add new steps for second tour
      await service.pushStep(mockElement2, 'Step 2');
      await service.pushStep(mockElement3, 'Step 3');

      // Start new tour
      service.startTour();
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be on first step of new tour
      expect(store.helpStepIndex).toBe(0);

      // End tour immediately
      service.endTour();

      // Verify only the first step is dismissed, second remains
      expect(store.helpSteps).toBe(1);
    });

    it('should not dismiss any steps if endTour called before first step is shown', async () => {
      // Add steps
      await service.pushStep(mockElement1, 'Step 1');
      await service.pushStep(mockElement2, 'Step 2');

      // End tour immediately after starting (before 1-second delay)
      service.startTour();
      service.endTour();

      // Verify no steps were dismissed - both remain in queue
      expect(store.helpStepIndex).toBe(-1);
      expect(store.helpSteps).toBe(2); // Both steps remain
    });

    it('should dismiss all steps when completing tour with Next button', async () => {
      // Add two steps
      await service.pushStep(mockElement1, 'Step 1');
      await service.pushStep(mockElement2, 'Step 2');

      // Wait for tour to start
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Complete tour by clicking Next through all steps
      service.nextStep(); // Dismiss step 0, move to step 1
      await new Promise(resolve => setTimeout(resolve, 100));
      service.nextStep(); // Dismiss step 1, call endTour

      // Verify all steps dismissed
      expect(store.helpStepIndex).toBe(-1);
      expect(store.helpSteps).toBe(0); // No steps remain
    });
  });
});
