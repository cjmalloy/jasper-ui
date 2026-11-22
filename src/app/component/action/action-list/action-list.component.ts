import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { KeyValuePipe } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  TemplateRef,
  viewChild,
  ViewContainerRef
} from '@angular/core';
import { filter, Subscription } from 'rxjs';
import { FakeLinkDirective } from '../../../directive/fake-link.directive';
import { TitleDirective } from '../../../directive/title.directive';
import { Ref, writeRef } from '../../../model/ref';
import { Action } from '../../../model/tag';
import { ActionService } from '../../../service/action.service';
import { ProxyService } from '../../../service/api/proxy.service';
import { downloadRef, downloadUrl } from '../../../util/download';
import { ConfirmActionComponent } from '../confirm-action/confirm-action.component';
import { InlineButtonComponent } from '../inline-button/inline-button.component';

@Component({
  selector: 'app-action-list',
  templateUrl: './action-list.component.html',
  styleUrl: './action-list.component.scss',
  host: { 'class': 'action-list' },
  imports: [FakeLinkDirective, ConfirmActionComponent, TitleDirective, InlineButtonComponent, KeyValuePipe]
})
export class ActionListComponent {
  private proxy = inject(ProxyService);
  private acts = inject(ActionService);
  private overlay = inject(Overlay);
  private viewContainerRef = inject(ViewContainerRef);


  readonly ref = input.required<Ref>();
  readonly repostRef = input<Ref>();
  readonly showDownload = input(true);
  readonly mediaAttachment = input('');
  readonly groupedActions = input<Record<string, Action[]> | undefined>({});
  readonly groupedAdvancedActions = input<Record<string, Action[]>>();

  readonly actionsMenu = viewChild.required<TemplateRef<any>>('actionsMenu');

  overlayRef?: OverlayRef;

  private overlayEvents?: Subscription;
  private overlayResize?: ResizeObserver;

  constructor() {
    const destroyRef = inject(DestroyRef);

    destroyRef.onDestroy(() => {
      this.closeAdvanced();
    });
  }

  readonly advanced = computed(() => {
    const actions = this.groupedAdvancedActions();
    return !!actions && Object.keys(actions).length > 0;
  });

  apply$ = (actions: Action[]) => () => {
    this.closeAdvanced();
    return this.acts.apply$(actions, this.ref(), this.repostRef());
  }

  download() {
    downloadRef(writeRef(this.ref()));
  }

  downloadMedia() {
    if (!this.mediaAttachment()) return;
    downloadUrl(this.proxy, this.mediaAttachment());
  }

  showAdvanced(event: MouseEvent) {
    this.closeAdvanced();
    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo(event.currentTarget as HTMLElement)
      .withPositions([{
        originX: 'center',
        originY: 'center',
        overlayX: 'start',
        overlayY: 'top',
      }, {
        originX: 'center',
        originY: 'center',
        overlayX: 'start',
        overlayY: 'bottom',
      }])
      .withFlexibleDimensions(false)
      .withPush(true)
      .withViewportMargin(8);
    this.overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      // CDK will not push an overlay wider than the viewport, and it pushes the right edge
      // in by both viewport margins, so leave room for 8px on each side plus the extra 8px
      maxWidth: 'calc(100% - 24px)',
    });
    this.overlayRef.attach(new TemplatePortal(this.actionsMenu(), this.viewContainerRef));
    if (window.ResizeObserver) {
      // Reposition when the menu content resizes (e.g. confirm text) so it stays on screen
      const overlayRef = this.overlayRef;
      this.overlayResize = new ResizeObserver(() => overlayRef.updatePosition());
      this.overlayResize.observe(overlayRef.overlayElement.firstElementChild || overlayRef.overlayElement);
    }
    this.overlayEvents = this.overlayRef.outsidePointerEvents().subscribe((event: MouseEvent) => {
      switch (event.type) {
        case 'click':
        case 'pointerdown':
        case 'touchstart':
        case 'mousedown':
        case 'contextmenu':
          this.closeAdvanced();
      }
    });
    this.overlayRef.keydownEvents().pipe(filter(e => e.key === 'Escape')).subscribe(() => this.closeAdvanced());
  }

  closeAdvanced() {
    this.overlayResize?.disconnect();
    this.overlayResize = undefined;
    this.overlayRef?.dispose();
    this.overlayEvents?.unsubscribe();
    this.overlayRef = undefined;
    this.overlayEvents = undefined;
    return false;
  }
}
