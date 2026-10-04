import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { FakeLinkDirective } from '../../../directive/fake-link.directive';
import { TemplatePortal } from '@angular/cdk/portal';
import { KeyValuePipe } from '@angular/common';
import { Component, DestroyRef, TemplateRef, ViewContainerRef, input, viewChild, computed, inject } from '@angular/core';
import { filter, Subscription } from 'rxjs';
import { TitleDirective } from '../../../directive/title.directive';
import { Ref, writeRef } from '../../../model/ref';
import { Action } from '../../../model/tag';
import { ActionService } from '../../../service/action.service';
import { downloadRef, downloadUrl } from '../../../util/download';
import { ConfirmActionComponent } from '../confirm-action/confirm-action.component';
import { InlineButtonComponent } from '../inline-button/inline-button.component';
import { ProxyService } from '../../../service/api/proxy.service';

@Component({
  selector: 'app-action-list',
  templateUrl: './action-list.component.html',
  styleUrl: './action-list.component.scss',
  host: { 'class': 'actions' },
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
    const origin = event.detail === 0
      ? event.currentTarget as HTMLElement
      : {x: event.x, y: event.y};
    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo(origin)
      .withPositions([{
        originX: 'center',
        originY: 'center',
        overlayX: 'start',
        overlayY: 'top',
      }]);
    this.overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.close(),
    });
    this.overlayRef.attach(new TemplatePortal(this.actionsMenu(), this.viewContainerRef));
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
    this.overlayRef?.dispose();
    this.overlayEvents?.unsubscribe();
    this.overlayRef = undefined;
    this.overlayEvents = undefined;
    return false;
  }
}
