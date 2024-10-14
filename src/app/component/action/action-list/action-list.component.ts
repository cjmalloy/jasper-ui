import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Input,
  NgZone,
  TemplateRef,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import { debounce, defer, delay } from 'lodash-es';
import { Subscription } from 'rxjs';
import { Ref, writeRef } from '../../../model/ref';
import { Action } from '../../../model/tag';
import { ActionService } from '../../../service/action.service';
import { ConfigService } from '../../../service/config.service';
import { downloadRef } from '../../../util/download';
import { memo } from '../../../util/memo';

@Component({
  selector: 'app-action-list',
  templateUrl: './action-list.component.html',
  styleUrl: './action-list.component.scss'
})
export class ActionListComponent implements AfterViewInit {

  @Input()
  ref!: Ref;
  @Input()
  repostRef?: Ref;
  @Input()
  showDownload = true;
  @Input()
  mediaAttachment = '';
  @Input()
  groupedActions?: { [key: string]: Action[] } = {};
  @Input()
  groupedAdvancedActions?: { [key: string]: Action[] };

  @ViewChild('actionsMenu')
  actionsMenu!: TemplateRef<any>;

  hiddenActions = 0;
  overlayRef?: OverlayRef;

  private overlayEvents?: Subscription;
  private resizeObserver = window.ResizeObserver && new ResizeObserver(() => this.onResize()) || undefined;

  constructor(
    private config: ConfigService,
    private acts: ActionService,
    private overlay: Overlay,
    private el: ElementRef<HTMLElement>,
    private viewContainerRef: ViewContainerRef,
    private zone: NgZone,
  ) { }

  ngAfterViewInit() {
    this.resizeObserver?.observe(this.el.nativeElement!.parentElement!);
    this.onResize();
  }

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

  @HostListener('window:resize')
  onResize() {
    if (!this.actions) return;
    this.measureVisible();
  }

  measureVisible = debounce(() => {
    if (!this.actions) return;
    defer(() => this.hiddenActions = this.actions - this.visible);
    delay(() => this.hiddenActions = this.actions - this.visible, 500);
  }, 400);

  @memo
  get actions() {
    return Object.keys(this.groupedActions as any).length;
  }

  @memo
  get actionWidths() {
    const el = this.el.nativeElement;
    const result: number[] = [];
    for (let i = 0; i < el!.children.length; i++) {
      const e = el.parentElement!.children[i] as HTMLElement;
      const s = getComputedStyle(e);
      result.push(e.offsetWidth + parseInt(s.marginLeft) + parseInt(s.marginRight));
    }
    return result;
  }

  get visible() {
    if (this.config.mobile) return this.actions;
    const el = this.el.nativeElement;
    const parentWidth = el.parentElement!.offsetWidth;
    let result = 0;
    let childWidth = 0;
    for (let i = 0; i < el.parentElement!.children.length - 1; i++) {
      const e = el.parentElement!.children[i] as HTMLElement;
      const s = getComputedStyle(e);
      childWidth += e.offsetWidth + parseInt(s.marginLeft) + parseInt(s.marginRight);
    }
    for (const w of this.actionWidths) {
      childWidth += w;
      if (childWidth < parentWidth) result++;
    }
    return result;
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
