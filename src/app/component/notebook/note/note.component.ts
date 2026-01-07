import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { AsyncPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  HostBinding,
  HostListener,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  TemplateRef,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { defer, delay, difference, intersection, uniq } from 'lodash-es';
import { catchError, of, Subject, Subscription, switchMap, takeUntil, throwError } from 'rxjs';
import { Ext } from '../../../model/ext';
import { equalsRef, Ref } from '../../../model/ref';
import { CssUrlPipe } from '../../../pipe/css-url.pipe';
import { ThumbnailPipe } from '../../../pipe/thumbnail.pipe';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { RefService } from '../../../service/api/ref.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { AuthzService } from '../../../service/authz.service';
import { BookmarkService } from '../../../service/bookmark.service';
import { ConfigService } from '../../../service/config.service';
import { Store } from '../../../store/store';
import { getTitle, hasComment } from '../../../util/format';
import { printError } from '../../../util/http';
import { memo, MemoCache } from '../../../util/memo';
import { expandedTagsInclude, hasTag, repost } from '../../../util/tag';
import { ChessComponent } from '../../chess/chess.component';
import { LoadingComponent } from '../../loading/loading.component';
import { MdComponent } from '../../md/md.component';
import { TodoComponent } from '../../todo/todo.component';

@Component({
  selector: 'app-note',
  templateUrl: './note.component.html',
  styleUrls: ['./note.component.scss'],
  host: { 'class': 'note' },
  imports: [
    forwardRef(() => MdComponent),
    LoadingComponent,
    RouterLink,
    ChessComponent,
    TodoComponent,
    AsyncPipe,
    ThumbnailPipe,
    CssUrlPipe,
  ],
})
export class NoteComponent implements OnChanges, AfterViewInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @HostBinding('class.unlocked')
  unlocked = false;

  @Input()
  ref!: Ref;
  @Input()
  pressToUnlock = false;
  @Input()
  hideSwimLanes = true;
  @Input()
  ext?: Ext;

  @Output()
  copied = new EventEmitter<Ref>();

  repostRef?: Ref;
  @HostBinding('class.full-size')
  todo = false;
  chess = false;
  chessWhite = true;
  overlayRef?: OverlayRef;
  autoClose = true;

  @ViewChild('cardMenu')
  cardMenu!: TemplateRef<any>;

  private overlayEvents?: Subscription;

  constructor(
    public store: Store,
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
    private zone: NgZone,
  ) { }

  init() {
    MemoCache.clear(this);
    this.todo = !!this.admin.getPlugin('plugin/todo') && !!this.ref.tags?.includes('plugin/todo');
    this.chess = !!this.admin.getPlugin('plugin/chess') && !!this.ref.tags?.includes('plugin/chess');
    this.chessWhite = !!this.ref.tags?.includes(this.store.account.localTag);
    if (this.repost && this.ref && this.repostRef?.url != repost(this.ref)) {
      (this.store.view.top?.url === this.ref.sources![0]
          ? of(this.store.view.top)
          : this.refs.getCurrent(this.url)
      ).pipe(
        catchError(err => err.status === 404 ? of(undefined) : throwError(() => err)),
        takeUntil(this.destroy$),
      ).subscribe(ref => this.repostRef = ref);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.ref) {
      this.init();
    }
  }

  ngAfterViewInit(): void {
    delay(() => {
      if (this.lastSelected) {
        this.el.nativeElement.scrollIntoView({ behavior: 'smooth' });
      }
    }, 400);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('click')
  onClick() {
    if (!this.lastSelected && this.store.view.lastSelected) {
      this.store.view.clearLastSelected();
    }
  }

  @memo
  get remote() {
    return this.ref.modified && this.origin !== this.store.account.origin;
  }

  @memo
  get origin() {
    return this.repost ? this.repostRef?.origin : this.ref.origin;
  }

  @memo
  @HostBinding('class.no-write')
  get noWrite() {
    return !this.auth.writeAccess(this.ref);
  }

  @memo
  get repost() {
    return this.ref?.sources?.[0] && hasTag('plugin/repost', this.ref);
  }

  @memo
  get bareRepost() {
    return this.repost && !this.ref.title && !this.ref.comment;
  }

  @memo
  get url() {
    return this.repost ? this.ref.sources![0] : this.ref.url;
  }

  @memo
  get currentText() {
    if (this.chess || this.todo) return '';
    const value = this.ref?.comment || this.repostRef?.comment || '';
    if (this.ref?.title || hasComment(value)) return value;
    return '';
  }

  @memo
  get thumbnail() {
    return this.admin.getPlugin('plugin/thumbnail') &&
      hasTag('plugin/thumbnail', this.ref) || hasTag('plugin/thumbnail', this.repostRef);
  }

  @memo
  get thumbnailColor() {
    return this.thumbnail &&
      (this.ref?.plugins?.['plugin/thumbnail']?.color || this.repostRef?.plugins?.['plugin/thumbnail']?.color);
  }

  @memo
  get thumbnailEmoji() {
    return this.thumbnail &&
      (this.ref?.plugins?.['plugin/thumbnail']?.emoji || this.repostRef?.plugins?.['plugin/thumbnail']?.emoji) || '';
  }

  @memo
  get thumbnailRadius() {
    return this.thumbnail &&
      (this.ref?.plugins?.['plugin/thumbnail']?.radius || this.repostRef?.plugins?.['plugin/thumbnail']?.radius) || 0;
  }

  @memo
  get dependents() {
    return !hasTag('plugin/comment', this.ref) && !hasTag('plugin/thread', this.ref) && this.ref.sources?.length || 0;
  }

  @memo
  get dependencies() {
    return this.ref.metadata?.responses || 0;
  }

  @memo
  get thread() {
    if (!this.admin.getPlugin('plugin/thread')) return '';
    if (!hasTag('plugin/thread', this.ref) && !this.threads) return '';
    return this.ref.sources?.[1] || this.ref.sources?.[0] || this.ref.url;
  }

  @memo
  get threads() {
    if (!this.admin.getPlugin('plugin/thread')) return 0;
    return this.ref.metadata?.plugins?.['plugin/thread'] || 0;
  }

  @memo
  get comment() {
    if (!this.admin.getPlugin('plugin/comment')) return 0;
    return hasTag('plugin/comment', this.ref) || this.comments;
  }

  @memo
  get comments() {
    if (!this.admin.getPlugin('plugin/comment')) return 0;
    return this.ref.metadata?.plugins?.['plugin/comment'] || 0;
  }

  @memo
  get badges() {
    const badges = intersection(this.ref.tags, this.ext?.config?.badges || []);
    if (this.hideSwimLanes) return badges;
    return difference(badges, this.ext?.config?.swimLanes || []);
  }

  @memo
  get badgeExts$() {
    return this.exts.getCachedExts(this.badges, this.ref.origin || '');
  }

  @memo
  get allBadgeExts$() {
    return this.exts.getCachedExts(this.ext?.config?.badges || [], this.ref.origin || '');
  }

  @HostBinding('class.last-selected')
  get lastSelected() {
    return this.store.view.lastSelected?.url === this.ref.url;
  }

  @HostListener('touchend', ['$event'])
  touchend(e: TouchEvent) {
    this.zone.run(() => this.unlocked = false);
  }

  @HostListener('press', ['$event'])
  unlock(event: any) {
    if (!this.config.mobile) return;
    this.unlocked = true;
    this.el.nativeElement.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    if ('vibrate' in navigator) navigator.vibrate([2, 32, 4]);
  }

  @memo
  get title() {
    if (this.bareRepost) return getTitle(this.repostRef) || $localize`Repost`;
    return getTitle(this.ref);
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
            this.zone.run(() => this.close());
        }
      });
    });
  }

  saveRef() {
    this.store.view.preloadRef(this.ref, this.repostRef);
  }

  close() {
    this.autoClose = true;
    this.overlayRef?.dispose();
    this.overlayEvents?.unsubscribe();
    this.overlayRef = undefined;
    this.overlayEvents = undefined;
  }

  toggleBadge(tag: string, event?: MouseEvent) {
    if (hasTag(tag, this.ref.tags)) {
      this.tags.delete(tag, this.ref.url, this.ref.origin).subscribe(() => {
        this.ref.tags = this.ref.tags!.filter(t => expandedTagsInclude(t, tag));
        this.init();
      });
    } else {
      this.tags.create(tag, this.ref.url, this.ref.origin).subscribe(() => {
        this.ref.tags ||= [];
        this.ref.tags.push(tag);
        this.init();
      });
    }
    if (this.autoClose || !event?.button) {
      this.close();
    } else {
      event.preventDefault();
    }
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
    this.refs.create(copied).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 409) {
          return this.refs.get(this.ref.url, this.store.account.origin).pipe(
            switchMap(existing => {
              if (equalsRef(existing, copied) || confirm('An old version already exists. Overwrite it?')) {
                // TODO: Show diff and merge or split
                return this.refs.update({ ...copied, modifiedString: existing.modifiedString });
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
      switchMap(() => this.refs.get(copied.url, this.store.account.origin).pipe(takeUntil(this.destroy$))),
    ).subscribe(ref => {
      this.ref = ref;
      this.init();
      this.copied.emit(ref);
    });
  }
}
