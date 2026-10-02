import {
  Overlay,
  OverlayRef
} from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { AsyncPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, inject, Component, ElementRef, forwardRef, TemplateRef, ViewContainerRef, ChangeDetectionStrategy, input, output, signal, viewChild, computed, linkedSignal, effect, untracked, afterNextRender } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { defer, delay, difference, intersection, uniq } from 'lodash-es';
import { catchError, of, startWith, Subscription, switchMap, throwError } from 'rxjs';
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
import { expandedTagsInclude, hasTag, repost } from '../../../util/tag';
import { ChessComponent } from '../../chess/chess.component';
import { LoadingComponent } from '../../loading/loading.component';
import { MdComponent } from '../../md/md.component';
import { TodoComponent } from '../../todo/todo.component';

@Component({
  selector: 'app-note',
  templateUrl: './note.component.html',
  styleUrls: ['./note.component.scss'],
  host: {
    'class': 'note',
    '[class.unlocked]': 'unlocked()',
    '[class.full-size]': 'todo()',
    '(click)': 'onClick()',
    '(touchend)': 'touchend($event)',
    '(press)': 'unlock($event)',
    '(contextmenu)': 'contextMenu($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
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
export class NoteComponent {
  private destroyRef = inject(DestroyRef);

  readonly unlocked = signal(false);

  readonly refInput = input.required<Ref>({ alias: 'ref' });
  readonly ref = linkedSignal(() => this.refInput());
  readonly pressToUnlock = input(false);
  readonly hideSwimLanes = input(true);
  readonly ext = input<Ext>();

  readonly copied = output<Ref>();

  readonly repostRef = toSignal(toObservable(computed(() =>
    this.repost() ? this.url() : undefined,
  )).pipe(switchMap(url => !url ? of(undefined) :
    (this.store.view.top()?.url === url ? of(this.store.view.top()) : this.refs.getCurrent(url)).pipe(
      catchError(err => err.status === 404 ? of(undefined) : throwError(() => err)),
      startWith(undefined),
    ))), { initialValue: undefined });

  readonly todo = computed(() => !!this.admin.getPlugin('plugin/todo') && !!this.ref().tags?.includes('plugin/todo'));
  readonly chess = computed(() => !!this.admin.getPlugin('plugin/chess') && !!this.ref().tags?.includes('plugin/chess'));
  readonly chessWhite = computed(() => !!this.ref().tags?.includes(this.store.account.localTag()));
  overlayRef?: OverlayRef;
  readonly autoClose = signal(true);

  readonly cardMenu = viewChild.required<TemplateRef<any>>('cardMenu');

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
  ) {}

  private readonly initializeView = afterNextRender(() => {
    delay(() => {
      if (this.lastSelected()) {
        this.el.nativeElement.scrollIntoView({ behavior: 'smooth' });
      }
    }, 400);
  });


  onClick() {
    if (!this.lastSelected() && this.store.view.lastSelected()) {
      this.store.view.clearLastSelected();
    }
  }
  readonly remote = computed(() => {
    return this.ref().modified && this.origin() !== this.store.account.origin();
  });
  readonly origin = computed(() => {
    return this.repost() ? this.repostRef()?.origin : this.ref().origin;
  });
  readonly noWrite = computed(() => {
    return !this.auth.writeAccess(this.ref());
  });
  readonly repost = computed(() => {
    return this.ref()?.sources?.[0] && hasTag('plugin/repost', this.ref());
  });
  readonly bareRepost = computed(() => {
    return this.repost() && !this.ref().title && !this.ref().comment;
  });
  readonly url = computed(() => {
    return this.repost() ? this.ref().sources![0] : this.ref().url;
  });
  readonly currentText = computed(() => {
    if (this.chess() || this.todo()) return '';
    const value = this.ref()?.comment || this.repostRef()?.comment || '';
    if (this.ref()?.title || hasComment(value)) return value;
    return '';
  });
  readonly thumbnail = computed(() => {
    return this.admin.getPlugin('plugin/thumbnail') &&
      hasTag('plugin/thumbnail', this.ref()) || hasTag('plugin/thumbnail', this.repostRef());
  });
  readonly thumbnailColor = computed(() => {
    return this.thumbnail() &&
      (this.ref()?.plugins?.['plugin/thumbnail']?.color || this.repostRef()?.plugins?.['plugin/thumbnail']?.color);
  });
  readonly thumbnailEmoji = computed(() => {
    return this.thumbnail() &&
      (this.ref()?.plugins?.['plugin/thumbnail']?.emoji || this.repostRef()?.plugins?.['plugin/thumbnail']?.emoji) || '';
  });
  readonly thumbnailRadius = computed(() => {
    return this.thumbnail() &&
      (this.ref()?.plugins?.['plugin/thumbnail']?.radius || this.repostRef()?.plugins?.['plugin/thumbnail']?.radius) || 0;
  });
  readonly dependents = computed(() => {
    return !hasTag('plugin/comment', this.ref()) && !hasTag('plugin/thread', this.ref()) && this.ref().sources?.length || 0;
  });
  readonly dependencies = computed(() => {
    return this.ref().metadata?.responses || 0;
  });
  readonly thread = computed(() => {
    if (!this.admin.getPlugin('plugin/thread')) return '';
    if (!hasTag('plugin/thread', this.ref()) && !this.threads()) return '';
    return this.ref().sources?.[1] || this.ref().sources?.[0] || this.ref().url;
  });
  readonly threads = computed(() => {
    if (!this.admin.getPlugin('plugin/thread')) return 0;
    return this.ref().metadata?.plugins?.['plugin/thread'] || 0;
  });
  readonly comment = computed(() => {
    if (!this.admin.getPlugin('plugin/comment')) return 0;
    return hasTag('plugin/comment', this.ref()) || this.comments();
  });
  readonly comments = computed(() => {
    if (!this.admin.getPlugin('plugin/comment')) return 0;
    return this.ref().metadata?.plugins?.['plugin/comment'] || 0;
  });
  readonly badges = computed(() => {
    const badges = intersection(this.ref().tags, this.ext()?.config?.badges || []);
    if (this.hideSwimLanes()) return badges;
    return difference(badges, this.ext()?.config?.swimLanes || []);
  });
  readonly badgeExts = toSignal(toObservable(computed(() =>
    [this.badges(), this.ref().origin || ''] as const)).pipe(
    switchMap(([tags, origin]) => this.exts.getCachedExts(tags, origin)),
  ), { initialValue: [] });
  readonly allBadgeExts = toSignal(toObservable(computed(() =>
    [this.ext()?.config?.badges || [], this.ref().origin || ''] as const)).pipe(
    switchMap(([tags, origin]) => this.exts.getCachedExts(tags, origin)),
  ), { initialValue: [] });
  readonly lastSelected = computed(() => {
    return this.store.view.lastSelected()?.url === this.ref().url;
  });

  touchend(e: TouchEvent) {
    this.unlocked.set(false);
  }

  unlock(event: any) {
    if (!this.config.mobile) return;
    this.unlocked.set(true);
    this.el.nativeElement.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    if ('vibrate' in navigator) navigator.vibrate([2, 32, 4]);
  }
  readonly title = computed(() => {
    if (this.bareRepost()) return getTitle(this.repostRef()) || $localize`Repost`;
    return getTitle(this.ref());
  });

  contextMenu(event: MouseEvent) {
    if (this.pressToUnlock()) {
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
      this.overlayRef.attach(new TemplatePortal(this.cardMenu(), this.viewContainerRef));
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

  saveRef() {
    this.store.view.preloadRef(this.ref(), this.repostRef());
  }

  close() {
    this.autoClose.set(true);
    this.overlayRef?.dispose();
    this.overlayEvents?.unsubscribe();
    this.overlayRef = undefined;
    this.overlayEvents = undefined;
  }

  toggleBadge(tag: string, event?: MouseEvent) {
    if (hasTag(tag, this.ref().tags)) {
      this.tags.delete(tag, this.ref().url, this.ref().origin).subscribe(() => {
        this.ref.set({ ...this.ref(), tags: this.ref().tags!.filter(t => expandedTagsInclude(t, tag)) });
      });
    } else {
      this.tags.create(tag, this.ref().url, this.ref().origin).subscribe(() => {
        this.ref.set({ ...this.ref(), tags: [...(this.ref().tags || []), tag] });
      });
    }
    if (this.autoClose() || !event?.button) {
      this.close();
    } else {
      event.preventDefault();
    }
  }

  copy() {
    const tags = uniq([
      ...(this.store.account.localTag() ? [this.store.account.localTag()] : []),
      ...(this.ref().tags || []).filter(t => this.auth.canAddTag(t))
    ]);
    const copied = {
      ...this.ref(),
      origin: this.store.account.origin(),
      tags,
    };
    this.refs.create(copied).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 409) {
          return this.refs.get(this.ref().url, this.store.account.origin()).pipe(
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
      switchMap(() => this.refs.get(copied.url, this.store.account.origin()).pipe(takeUntilDestroyed(this.destroyRef))),
    ).subscribe(ref => {
      this.ref.set(ref);
      this.copied.emit(ref);
    });
  }
}
