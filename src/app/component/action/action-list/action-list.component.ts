import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { KeyValuePipe } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Input,
  NgZone,
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
  selector: 'app-action-list',
  templateUrl: './action-list.component.html',
  styleUrl: './action-list.component.scss',
  imports: [ConfirmActionComponent, TitleDirective, InlineButtonComponent, KeyValuePipe]
})
export class ActionListComponent implements AfterViewInit, OnChanges {

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
  @ViewChild('multiActionsMenu')
  multiActionsMenu!: TemplateRef<any>;

  hiddenActions = 0;
  overlayRef?: OverlayRef;
  multiActionsLabel = '';
  multiActions: Action[] = [];
  rememberMultiAction = false;

  private overlayEvents?: Subscription;
  private overlayResizeObserver? = window.ResizeObserver && new ResizeObserver(() => this.overlayRef?.updatePosition()) || undefined;
  private resizeObserver? = window.ResizeObserver && new ResizeObserver(() => this.onResize()) || undefined;

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
    return this.acts.apply$(actions, this.ref, this.repostRef);
  }

  applySingle$ = (action: Action) => () => {
    this.persistMultiSelection(action);
    this.closeAdvanced();
    return this.acts.apply$(action, this.ref, this.repostRef);
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

  measureVisible() {
    if (!this.actions) return;
    this.hiddenActions = this.actions - this.visible;
  }

  @memo
  get actions() {
    return Object.keys(this.groupedActions as any).length;
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

  showMulti(actions: Action[]) {
    return actions.length > 1 && actions.some(action => action.multi);
  }

  triggerActions(event: MouseEvent, label: string, actions: Action[]) {
    const remembered = this.rememberedMultiAction(label, actions);
    if (remembered) return this.applySingle$(remembered)();
    if (this.showMulti(actions)) return this.showMultiActions(event, label, actions);
    return this.apply$(actions)();
  }

  multiActionSource(action: Action) {
    return action._parent?.config?.mod || action._parent?.name || action.title || action._parent?.tag || 'Action';
  }

  rememberedMultiAction(label: string, actions: Action[]) {
    if (!this.showMulti(actions)) return undefined;
    const remembered = this.storage?.getItem(this.multiActionStorageKey(label, actions));
    if (!remembered) return undefined;
    const action = actions.find(candidate => this.multiActionId(candidate) === remembered);
    if (action) return action;
    this.storage?.removeItem(this.multiActionStorageKey(label, actions));
    return undefined;
  }

  showAdvanced(event: MouseEvent) {
    this.closeAdvanced();
    defer(() => {
      this.openMenu(event, this.actionsMenu);
    });
  }

  showMultiActions(event: MouseEvent, label: string, actions: Action[]) {
    this.multiActionsLabel = label;
    this.multiActions = actions;
    this.rememberMultiAction = false;
    this.closeAdvanced();
    defer(() => this.openMenu(event, this.multiActionsMenu));
  }

  closeAdvanced() {
    if (this.overlayRef?.overlayElement) this.overlayResizeObserver?.unobserve(this.overlayRef?.overlayElement);
    this.overlayRef?.dispose();
    this.overlayEvents?.unsubscribe();
    this.overlayRef = undefined;
    this.overlayEvents = undefined;
    return false;
  }

  private openMenu(event: MouseEvent, template: TemplateRef<any>) {
    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo({ x: event.x, y: event.y })
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
    this.overlayRef.attach(new TemplatePortal(template, this.viewContainerRef));
    this.overlayEvents = this.overlayRef.outsidePointerEvents().subscribe((outsideEvent: MouseEvent) => {
      switch (outsideEvent.type) {
        case 'click':
        case 'pointerdown':
        case 'touchstart':
        case 'mousedown':
        case 'contextmenu':
          this.zone.run(() => this.closeAdvanced());
      }
    });
    this.overlayResizeObserver?.observe(this.overlayRef.overlayElement);
  }

  private persistMultiSelection(action: Action) {
    if (!this.multiActionsLabel || !this.multiActions.length) return;
    const key = this.multiActionStorageKey(this.multiActionsLabel, this.multiActions);
    if (this.rememberMultiAction) {
      this.storage?.setItem(key, this.multiActionId(action));
    } else {
      this.storage?.removeItem(key);
    }
  }

  private multiActionStorageKey(label: string, actions: Action[]) {
    return `multi-action:${label}:${actions.map(action => this.multiActionId(action)).sort().join('|')}`;
  }

  private multiActionId(action: Action) {
    return JSON.stringify({
      parent: action._parent?.tag,
      tag: 'tag' in action ? action.tag : undefined,
      response: 'response' in action ? action.response : undefined,
      event: 'event' in action ? action.event : undefined,
      emit: 'emit' in action ? action.emit : undefined,
      label: 'label' in action ? action.label : undefined,
      labelOn: 'labelOn' in action ? action.labelOn : undefined,
      labelOff: 'labelOff' in action ? action.labelOff : undefined,
    });
  }

  private get storage() {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  }
}
