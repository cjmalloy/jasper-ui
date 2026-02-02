import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { KeyValuePipe } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  Input,
  input,
  OnChanges,
  SimpleChanges,
  TemplateRef,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import { defer } from 'lodash-es';
import { Subscription } from 'rxjs';
import { TitleDirective } from '../../../directive/title.directive';
import { Ref, writeRef } from '../../../model/ref';
import { Action } from '../../../model/tag';
import { ActionService } from '../../../service/action.service';
import { ConfigService } from '../../../service/config.service';
import { downloadRef } from '../../../util/download';
import { memo, MemoCache } from '../../../util/memo';
import { ConfirmActionComponent } from '../confirm-action/confirm-action.component';
import { InlineButtonComponent } from '../inline-button/inline-button.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-action-list',
  templateUrl: './action-list.component.html',
  styleUrl: './action-list.component.scss',
  imports: [ConfirmActionComponent, TitleDirective, InlineButtonComponent, KeyValuePipe]
})
export class ActionListComponent implements AfterViewInit, OnChanges {
  private config = inject(ConfigService);
  private acts = inject(ActionService);
  private overlay = inject(Overlay);
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private viewContainerRef = inject(ViewContainerRef);


  readonly ref = input.required<Ref>();
  readonly repostRef = input<Ref>();
  readonly showDownload = input(true);
  @Input()
  mediaAttachment = '';
  readonly groupedActions = input<{
    [key: string]: Action[];
} | undefined>({});
  @Input()
  groupedAdvancedActions?: { [key: string]: Action[] };

  @ViewChild('actionsMenu')
  actionsMenu!: TemplateRef<any>;

  hiddenActions = 0;
  overlayRef?: OverlayRef;

  private overlayEvents?: Subscription;
  private overlayResizeObserver? = window.ResizeObserver && new ResizeObserver(() => this.overlayRef?.updatePosition()) || undefined;
  private resizeObserver? = window.ResizeObserver && new ResizeObserver(() => this.onResize()) || undefined;

  ngAfterViewInit() {
    this.resizeObserver?.observe(this.el.nativeElement!.parentElement!);
  }

  ngOnChanges(changes: SimpleChanges) {
    MemoCache.clear(this);
    defer(() => this.onResize());
  }

  @memo
  get advanced() {
    return this.groupedAdvancedActions && Object.keys(this.groupedAdvancedActions as any).length > 0;
  }

  apply$ = (actions: Action[]) => () => {
    this.closeAdvanced();
    return this.acts.apply$(actions, this.ref(), this.repostRef());
  }

  download() {
    downloadRef(writeRef(this.ref()));
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

  measureVisible() {
    if (!this.actions) return;
    this.hiddenActions = this.actions - this.visible;
  }

  @memo
  get actions() {
    return Object.keys(this.groupedActions() as any).length;
  }

  @memo
  get actionWidths() {
    const el = this.el.nativeElement;
    const result: number[] = [];
    for (let i = 0; i < el.children.length; i++) {
      const e = el.children[i] as HTMLElement;
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
            this.closeAdvanced();
        }
      });
      this.overlayResizeObserver?.observe(this.overlayRef.overlayElement);
    });
  }

  closeAdvanced() {
    if (this.overlayRef?.overlayElement) this.overlayResizeObserver?.unobserve(this.overlayRef?.overlayElement);
    this.overlayRef?.dispose();
    this.overlayEvents?.unsubscribe();
    this.overlayRef = undefined;
    this.overlayEvents = undefined;
    return false;
  }
}
