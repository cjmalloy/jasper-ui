import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  NgZone,
  TemplateRef,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import { defer } from 'lodash-es';
import { Subscription } from 'rxjs';
import { Ref, writeRef } from '../../../model/ref';
import { Action } from '../../../model/tag';
import { ActionService } from '../../../service/action.service';
import { downloadRef } from '../../../util/download';

@Component({
  selector: 'app-action-list',
  templateUrl: './action-list.component.html',
  styleUrl: './action-list.component.scss'
})
export class ActionListComponent {

  @Input()
  ref!: Ref;
  @Input()
  repostRef?: Ref;
  @Input()
  showDownload = true;
  @Input()
  mediaAttachment = '';
  @Input()
  groupedActions?: { [key: string]: Action[] };
  @Input()
  groupedAdvancedActions?: { [key: string]: Action[] };

  @ViewChild('actionsMenu')
  actionsMenu!: TemplateRef<any>;

  overlayRef?: OverlayRef;

  private overlayEvents?: Subscription;

  constructor(
    private acts: ActionService,
    private overlay: Overlay,
    private viewContainerRef: ViewContainerRef,
    private zone: NgZone,
  ) { }

  apply$ = (actions: Action[]) => () => {
    this.closeAdvanced();
    return this.acts.apply$(actions, this.ref, this.repostRef);
  }

  download() {
    downloadRef(writeRef(this.ref));
  }

  downloadMedia() {
    if (!this.mediaAttachment) return;
    window.open(this.mediaAttachment, "_blank");
  }

  showAdvanced(event: MouseEvent) {
    this.closeAdvanced();
    defer(() => {
      const positionStrategy = this.overlay.position()
        .flexibleConnectedTo({x: event.x, y: event.y})
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
      this.overlayRef.attach(new TemplatePortal(this.actionsMenu, this.viewContainerRef));
      this.overlayEvents = this.overlayRef.outsidePointerEvents().subscribe((event: MouseEvent) => {
        switch (event.type) {
          case 'click':
          case 'pointerdown':
          case 'touchstart':
          case 'mousedown':
          case 'contextmenu':
            this.zone.run(() => this.closeAdvanced());
        }
      });
    });
  }

  closeAdvanced() {
    this.overlayRef?.dispose();
    this.overlayEvents?.unsubscribe();
    this.overlayRef = undefined;
    this.overlayEvents = undefined;
    return false;
  }
}
