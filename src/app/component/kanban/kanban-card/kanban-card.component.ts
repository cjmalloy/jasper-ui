import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { HttpErrorResponse } from "@angular/common/http";
import {
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  OnInit,
  Output,
  TemplateRef,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import { defer, difference, intersection, uniq, without } from 'lodash-es';
import { catchError, Subscription, switchMap, throwError } from 'rxjs';
import { Ext } from '../../../model/ext';
import { equalsRef, Ref } from '../../../model/ref';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { RefService } from '../../../service/api/ref.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { AuthzService } from '../../../service/authz.service';
import { BookmarkService } from '../../../service/bookmark.service';
import { ConfigService } from '../../../service/config.service';
import { Store } from "../../../store/store";
import { hasComment, trimCommentForTitle } from '../../../util/format';
import { printError } from "../../../util/http";
import { hasTag, includesTag } from '../../../util/tag';

@Component({
  selector: 'app-kanban-card',
  templateUrl: './kanban-card.component.html',
  styleUrls: ['./kanban-card.component.scss']
})
export class KanbanCardComponent implements OnInit {
  @HostBinding('class') css = 'kanban-card';

  @HostBinding('class.unlocked')
  unlocked = false;

  @Input()
  pressToUnlock = false;
  @Input()
  hideSwimLanes = true;
  @Input()
  ext?: Ext;

  @Output()
  copied = new EventEmitter<Ref>();

  title = '';
  repostRef?: Ref;
  @HostBinding('class.full-size')
  todo = false;
  chess = false;
  chessWhite = true;
  overlayRef?: OverlayRef;

  @ViewChild('cardMenu')
  cardMenu!: TemplateRef<any>;

  private _ref!: Ref;
  private overlayEvents?: Subscription;

  constructor(
    private store: Store,
    public bookmarks: BookmarkService,
    private admin: AdminService,
    private config: ConfigService,
    private auth: AuthzService,
    private refs: RefService,
    private tags: TaggingService,
    private exts: ExtService,
    private overlay: Overlay,
    private el: ElementRef,
    private viewContainerRef: ViewContainerRef,
  ) { }

  ngOnInit(): void {
  }

  get ref() {
    return this._ref;
  }

  @Input()
  set ref(value: Ref) {
    this._ref = value;
    this.title = this.getTitle();
    if (value) {
      this.todo = !!this.admin.getPlugin('plugin/todo') && !!value.tags?.includes('plugin/todo');
      this.chess = !!this.admin.getPlugin('plugin/chess') && !!value.tags?.includes('plugin/chess');
      this.chessWhite = !!value.tags?.includes(this.store.account.localTag);
      if (this.repost && value && (!this.repostRef || this.repostRef.url != value.url && this.repostRef.origin === value.origin)) {
        this.refs.get(this.url, value.origin)
          .subscribe(ref => {
            this.repostRef = ref;
            if (this.bareRepost) {
              this.title = this.getTitle();
            }
          });
      }
    }
  }

  get remote() {
    return this.origin !== this.store.account.origin;
  }

  get origin() {
    return this.repost ? this.repostRef?.origin : this.ref.origin;
  }

  @HostBinding('class.no-write')
  get noWrite() {
    return !this.auth.writeAccess(this.ref);
  }

  get repost() {
    return this.ref?.sources?.length && hasTag('plugin/repost', this.ref);
  }

  get bareRepost() {
    return this.repost && !this.ref.title && !this.ref.comment;
  }

  get url() {
    return this.repost ? this.ref.sources![0] : this.ref.url;
  }

  get currentText() {
    if (this.chess || this.todo) return '';
    const value = this.ref?.comment || this.repostRef?.comment || '';
    if (this.ref?.title || hasComment(value)) return value;
    return '';
  }

  get thumbnail() {
    return this.admin.status.plugins.thumbnail &&
      hasTag('plugin/thumbnail', this.ref) || hasTag('plugin/thumbnail', this.repostRef);
  }

  get thumbnailUrl() {
    return this.thumbnail && !this.thumbnailColor;
  }

  get thumbnailColor() {
    return this.thumbnail &&
      (this.ref?.plugins?.['plugin/thumbnail']?.color || this.repostRef?.plugins?.['plugin/thumbnail']?.color);
  }

  get thumbnailEmoji() {
    return this.thumbnail &&
      (this.ref?.plugins?.['plugin/thumbnail']?.emoji || this.repostRef?.plugins?.['plugin/thumbnail']?.emoji) || '';
  }

  get thumbnailRadius() {
    return this.thumbnail &&
      (this.ref?.plugins?.['plugin/thumbnail']?.radius || this.repostRef?.plugins?.['plugin/thumbnail']?.radius) || 0;
  }

  get badges() {
    const badges = intersection(this.ref.tags, this.ext?.config?.badges || []);
    if (this.hideSwimLanes) return badges;
    return difference(badges, this.ext?.config?.swimLanes || []);
  }

  get badgeExts$() {
    return this.exts.getCachedExts(this.badges, this.ref.origin || '');
  }

  get allBadgeExts$() {
    return this.exts.getCachedExts(this.ext?.config?.badges || [], this.ref.origin || '');
  }

  @HostListener('touchend', ['$event'])
  touchend(e: TouchEvent) {
    this.unlocked = false;
  }

  @HostListener('press', ['$event'])
  unlock(event: any) {
    if (!this.config.mobile) return;
    this.unlocked = true;
    this.el.nativeElement.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    if ('vibrate' in navigator) defer(() => navigator.vibrate([2, 32, 2]));
  }

  getTitle() {
    if (this.bareRepost) return this.repostRef?.title || $localize`Repost`;
    const title = (this.ref.title || '').trim();
    const comment = (this.ref.comment || '').trim();
    if (title) return title;
    if (!comment) return this.url;
    return trimCommentForTitle(comment);
  }

  @HostListener('contextmenu', ['$event'])
  contextMenu(event: MouseEvent) {
    if (this.pressToUnlock) {
      // no badge menu on mobile
      return;
    }
    event.preventDefault();
    this.close();
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
      this.overlayRef.attach(new TemplatePortal(this.cardMenu, this.viewContainerRef));
      this.overlayEvents = this.overlayRef.outsidePointerEvents().subscribe((event: MouseEvent) => {
        switch (event.type) {
          case 'click':
          case 'pointerdown':
          case 'touchstart':
          case 'mousedown':
          case 'contextmenu':
            this.close();
        }
      });
    });
  }

  close() {
    this.overlayRef?.dispose();
    this.overlayEvents?.unsubscribe();
    this.overlayRef = undefined;
    this.overlayEvents = undefined;
  }

  toggleBadge(tag: string) {
    if (includesTag(tag, this.ref.tags)) {
      this.tags.delete(tag, this.ref.url, this.ref.origin).subscribe(() => {
        this.ref.tags = without(this.ref.tags, tag);
      });
    } else {
      this.tags.create(tag, this.ref.url, this.ref.origin).subscribe(() => {
        this.ref.tags ||= [];
        this.ref.tags.push(tag);
      });
    }
    this.close();
  }

  copy() {
    const tags = uniq([
      ...(this.store.account.localTag ? [this.store.account.localTag] : []),
      ...(this.ref.tags || []).filter(t => this.auth.canAddTag(t))
    ]);
    const copied = {
      ...this.ref,
      origin: this.store.account.origin,
      tags,
    };
    this.refs.create(copied, true).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 409) {
          return this.refs.get(this.ref.url, this.store.account.origin).pipe(
            switchMap(ref => {
              if (equalsRef(ref, copied) || window.confirm('An old version already exists. Overwrite it?')) {
                // TODO: Show diff and merge or split
                return this.refs.push(this.ref, this.store.account.origin);
              } else {
                return throwError(() => 'Cancelled')
              }
            })
          );
        }
        // TODO: better error messages
        console.error(printError(err));
        return throwError(() => err);
      }),
      switchMap(() => this.refs.get(copied.url, this.store.account.origin)),
    ).subscribe(ref => {
      this.ref = ref;
      this.copied.emit(ref);
    });
  }
}
