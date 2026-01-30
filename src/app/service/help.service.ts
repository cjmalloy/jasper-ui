import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { ElementRef, Injectable } from '@angular/core';
import { delay } from 'lodash-es';
import { runInAction } from 'mobx';
import { HelpPopupComponent } from '../component/help-popup/help-popup.component';
import { Store } from '../store/store';
import { AdminService } from './admin.service';

@Injectable({
  providedIn: 'root',
})
export class HelpService {
  private steps: { id: string, text: string, el: HTMLElement }[] = [];
  private overlayRef: OverlayRef | null = null;

  private shown: string[] = [];
  private maxIndexReached: number = -1;

  constructor(
    private store: Store,
    private overlay: Overlay,
    private admin: AdminService,
  ) {}

  /**
   * Adds a help step to the queue. If no tour is active, starts the tour.
   */
  async pushStep(el: HTMLElement | null, text: string) {
    // Only show help popups if config/help template is enabled
    if (!this.admin.getTemplate('config/help')) return;
    if (!el) return;
    const id = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text.substring(0, 150))).then(hash => {
      let result = '';
      const view = new DataView(hash);
      for (let i = 0; i < hash.byteLength; i += 4) {
        result += ('00000000' + view.getUint32(i).toString(16)).slice(-8);
      }
      return result;
    });
    if (this.shown.includes(id) || this.store.local.shownHelpPopup(id)) return;
    this.shown.push(id);
    this.steps.push({ id, el, text });
    runInAction(() => this.store.helpSteps = this.steps.length);
    if (this.store.helpStepIndex === -1) {
      // If no tour is active, start immediately with this step
      this.startTour();
    }
    // If a tour is active, the step is silently added to the queue
  }

  /**
   * Starts the help tour from the beginning or the current step.
   */
  startTour(): void {
    if (this.steps.length === 0) {
      console.warn('HelpService: No steps available to start the tour.');
      return;
    }

    if (this.store.helpStepIndex === -1) {
      this.maxIndexReached = -1;
      runInAction(() => this.store.helpStepIndex = 0);
    }

    delay(() => this.showCurrentStep(), 1000);
  }

  /**
   * Advances to the next help step.
   */
  nextStep(): void {
    this.store.local.dismissHelpPopup(this.steps[this.store.helpStepIndex].id);
    runInAction(() => this.store.helpStepIndex++);
    if (this.store.helpStepIndex < this.steps.length) {
      this.showCurrentStep();
    } else {
      this.endTour();
    }
  }

  /**
   * Goes back to the previous help step.
   */
  previousStep(): void {
    if (this.store.helpStepIndex > 0) {
      runInAction(() => this.store.helpStepIndex--);
      this.showCurrentStep();
    }
  }

  private showCurrentStep(): void {
    if (this.store.helpStepIndex < 0 || this.store.helpStepIndex >= this.steps.length) {
      this.endTour();
      return;
    }

    // Track the maximum index reached
    if (this.store.helpStepIndex > this.maxIndexReached) {
      this.maxIndexReached = this.store.helpStepIndex;
    }

    // Dismiss the current overlay if it exists
    this.dismissOverlay();

    const currentStep = this.steps[this.store.helpStepIndex];
    const element = currentStep.el;
    element.classList.add('help-element');

    // Create an overlay that attaches to the element
    this.overlayRef = this.overlay.create({
      positionStrategy: this.overlay
        .position()
        .flexibleConnectedTo(element)
        .withPositions([
          // Define preferred positions (e.g., below, above, right, left)
          { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
          { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
          { originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'center' },
          { originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'center' },
        ])
        .withPush(true), // Allow the overlay to push other elements
      scrollStrategy: this.overlay.scrollStrategies.reposition(), // Reposition on scroll
      hasBackdrop: true,
    });

    // Create a portal for the help popup component
    const popupPortal = new ComponentPortal(HelpPopupComponent);

    // Attach the portal to the overlay
    const popupRef = this.overlayRef.attach(popupPortal);

    // Pass data and connect events to the popup component instance
    popupRef.instance.text = currentStep.text;

    popupRef.instance.nextClick.subscribe(() => this.nextStep());
    popupRef.instance.previousClick.subscribe(() => this.previousStep());
    popupRef.instance.doneClick.subscribe(() => this.endTour());

    // Dismiss overlay when backdrop is clicked
    this.overlayRef.backdropClick().subscribe(() => this.endTour());
  }

  /**
   * Ends the help tour and dismisses the overlay.
   * Only dismisses steps that have been shown (up to max index reached).
   * Undisplayed steps remain available for future display.
   */
  endTour(): void {
    this.dismissOverlay();
    // Only dismiss the current step if we've actually shown it (maxIndexReached >= 0)
    const currentIndex = this.store.helpStepIndex;
    if (this.maxIndexReached >= 0 && currentIndex >= 0 && currentIndex < this.steps.length) {
      this.store.local.dismissHelpPopup(this.steps[currentIndex].id);
    }
    // Remove shown steps (up to max index reached) but keep undisplayed ones
    const undisplayedSteps = this.maxIndexReached >= 0 
      ? this.steps.slice(this.maxIndexReached + 1)
      : this.steps;
    this.steps = undisplayedSteps;
    this.maxIndexReached = -1;
    runInAction(() => {
      this.store.helpStepIndex = -1;
      this.store.helpSteps = this.steps.length;
    });
  }

  private dismissOverlay(): void {
    document.body.querySelectorAll('.help-element')
      .forEach((el) => el.classList.remove('help-element'));
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
    }
  }
}
