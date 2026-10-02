import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { FakeLinkDirective } from '../../../directive/fake-link.directive';
import { TemplatePortal } from '@angular/cdk/portal';
import { KeyValuePipe } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  TemplateRef,
  ViewContainerRef,
  input,
  signal,
  viewChild,
  computed
} from '@angular/core';
import { defer } from 'lodash-es';
import { Subscription } from 'rxjs';
import { TitleDirective } from '../../../directive/title.directive';
import { Ref, writeRef } from '../../../model/ref';
import { Action } from '../../../model/tag';
import { ActionService } from '../../../service/action.service';
import { ConfigService } from '../../../service/config.service';
import { downloadRef, downloadUrl } from '../../../util/download';
import { ConfirmActionComponent } from '../confirm-action/confirm-action.component';
import { InlineButtonComponent } from '../inline-button/inline-button.component';
import { ProxyService } from '../../../service/api/proxy.service';

@Component({
  selector: 'app-action-list',
  templateUrl: './action-list.component.html',
  styleUrl: './action-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:resize)': 'onResize()' },
  imports: [FakeLinkDirective, ConfirmActionComponent, TitleDirective, InlineButtonComponent, KeyValuePipe]
})
export class ActionListComponent implements AfterViewInit {

  readonly ref = input.required<Ref>();
  readonly repostRef = input<Ref>();
  readonly showDownload = input(true);
  readonly mediaAttachment = input('');
  readonly groupedActions = input<Record<string, Action[]> | undefined>({});
  readonly groupedAdvancedActions = input<Record<string, Action[]>>();

  readonly actionsMenu = viewChild.required<TemplateRef<any>>('actionsMenu');

  readonly hiddenActions = signal(0);
  overlayRef?: OverlayRef;

  private overlayEvents?: Subscription;
  private overlayResizeObserver? = window.ResizeObserver && new ResizeObserver(() => this.overlayRef?.updatePosition()) || undefined;
  private resizeObserver? = window.ResizeObserver && new ResizeObserver(() => this.onResize()) || undefined;

  constructor(
    private config: ConfigService,
    private proxy: ProxyService,
    private acts: ActionService,
    private overlay: Overlay,
    private el: ElementRef<HTMLElement>,
    private viewContainerRef: ViewContainerRef,
  ) {
    effect(() => {
      this.ref();
      this.repostRef();
      this.showDownload();
      this.mediaAttachment();
      this.groupedActions();
      this.groupedAdvancedActions();
      this.cachedActionWidths = undefined;
      defer(() => this.onResize());
    });
  }

  ngAfterViewInit() {
    this.resizeObserver?.observe(this.el.nativeElement!.parentElement!);
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

  onResize() {
    if (!this.actions()) return;
    this.measureVisible();
  }

  measureVisible() {
    if (!this.actions()) return;
    this.hiddenActions.set(this.actions() - this.visible);
  }
  readonly actions = computed(() => {
    return Object.keys(this.groupedActions() as any).length;
  });

  private cachedActionWidths?: number[];

  /**
   * Widths of the rendered actions, measured from the DOM. Cached until the
   * inputs change, since hidden actions are removed from the DOM.
   */
  actionWidths() {
    if (this.cachedActionWidths) return this.cachedActionWidths;
    const el = this.el.nativeElement;
    const result: number[] = [];
    for (let i = 0; i < el.children.length; i++) {
      const e = el.children[i] as HTMLElement;
      const s = getComputedStyle(e);
      result.push(e.offsetWidth + parseInt(s.marginLeft) + parseInt(s.marginRight));
    }
    return this.cachedActionWidths = result;
  }

  get visible() {
    if (this.config.mobile) return this.actions();
    const el = this.el.nativeElement;
    const parentWidth = el.parentElement!.offsetWidth;
    let result = 0;
    let childWidth = 0;
    for (let i = 0; i < el.parentElement!.children.length - 1; i++) {
      const e = el.parentElement!.children[i] as HTMLElement;
      const s = getComputedStyle(e);
      childWidth += e.offsetWidth + parseInt(s.marginLeft) + parseInt(s.marginRight);
    }
    for (const w of this.actionWidths()) {
      childWidth += w;
      if (childWidth < parentWidth) result++;
    }
    return result;
  }

  showAdvanced(event: MouseEvent) {
    this.closeAdvanced();
    const origin = event.detail === 0
      ? event.currentTarget as HTMLElement
      : {x: event.x, y: event.y};
    defer(() => {
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
