import { 
  ChangeDetectionStrategy,
  Component, HostBinding, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { catchError, of, Subject, takeUntil, throwError } from 'rxjs';
import { Ref } from '../../../model/ref';
import {
  Action,
  active,
  Icon,
  ResponseAction,
  sortOrder,
  TagAction,
  uniqueConfigs,
  Visibility,
  visible
} from '../../../model/tag';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { AuthzService } from '../../../service/authz.service';
import { Store } from '../../../store/store';
import { getTitle, templates } from '../../../util/format';
import { getScheme } from '../../../util/http';
import { memo, MemoCache } from '../../../util/memo';
import { hasTag, isAuthorTag, repost } from '../../../util/tag';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
  selector: 'app-file',
  templateUrl: './file.component.html',
  styleUrls: ['./file.component.scss']
})
export class FileComponent implements OnChanges, OnDestroy {
  css = 'file ';
  @HostBinding('attr.tabindex') tabIndex = 0;
  private destroy$ = new Subject<void>();

  @Input()
  ref!: Ref;
  @Input()
  expanded = false;
  @Input()
  expandInline = false;
  @Input()
  showToggle = false;
  @Input()
  dragging = false;
  @Input()
  fetchRepost = true;

  repostRef?: Ref;
  expandPlugins: string[] = [];
  icons: Icon[] = [];
  actions: Action[] = [];
  editing = false;
  viewSource = false;
  writeAccess = false;
  taggingAccess = false;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    private refs: RefService,
    public store: Store,
    private auth: AuthzService,
  ) { }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.ref) {
      MemoCache.clear(this);
      this.editing = false;
      this.viewSource = false;
      this.writeAccess = this.auth.writeAccess(this.ref);
      this.taggingAccess = this.auth.taggingAccess(this.ref);
      this.icons = uniqueConfigs(sortOrder(this.admin.getIcons(this.ref.tags, this.ref.plugins, getScheme(this.ref.url))));
      this.actions = uniqueConfigs(sortOrder(this.admin.getActions(this.ref.tags, this.ref.plugins)));

      this.expandPlugins = this.admin.getEmbeds(this.ref);
      if (this.repost && this.ref && this.fetchRepost && this.repostRef?.url != repost(this.ref)) {
        (this.store.view.top?.url === this.ref.sources![0]
            ? of(this.store.view.top)
            : this.refs.getCurrent(this.url)
        ).pipe(
          catchError(err => err.status === 404 ? of(undefined) : throwError(() => err)),
          takeUntil(this.destroy$),
        ).subscribe(ref => {
          this.repostRef = ref;
          if (!ref) return;
          MemoCache.clear(this);
          if (this.bareRepost) {
            this.expandPlugins = this.admin.getEmbeds(ref);
          } else {
            this.expandPlugins.push('plugin/repost');
          }
        });
      }
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @memo
  @HostBinding('class')
  get pluginClasses() {
    return this.css + templates(this.ref.tags, 'plugin')
      .map(t => t.replace(/\//g, '_').replace(/\./g, '-'))
      .join(' ');
  }

  @memo
  get nonLocalOrigin() {
    if (this.ref.origin === this.store.account.origin) return undefined;
    return this.ref.origin || '';
  }

  @memo
  get local() {
    return this.ref.origin === this.store.account.origin;
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
  get title() {
    if (this.bareRepost) return getTitle(this.repostRef) || $localize`Repost`;
    return getTitle(this.ref);
  }
  @memo
  get thumbnail() {
    if (!this.admin.getPlugin('plugin/thumbnail')) return false;
    return hasTag('plugin/thumbnail', this.ref) || hasTag('plugin/thumbnail', this.repostRef);
  }

  @memo
  get iconColor() {
    if (!this.thumbnail) return '';
    return this.ref?.plugins?.['plugin/thumbnail']?.color || this.repostRef?.plugins?.['plugin/thumbnail']?.color || '';
  }

  @memo
  get iconEmoji() {
    if (!this.thumbnail) return '';
    return this.ref?.plugins?.['plugin/thumbnail']?.emoji || this.repostRef?.plugins?.['plugin/thumbnail']?.emoji || '';
  }

  @memo
  get iconEmojiDefaults() {
    const icon = this.icons.filter(i => i.thumbnail || (i.label && (i.order || 0) >= 0) && this.showIcon(i))[0];
    return icon?.label || icon?.thumbnail;
  }

  @memo
  get iconRadius() {
    return this.ref?.plugins?.['plugin/thumbnail']?.radius || this.repostRef?.plugins?.['plugin/thumbnail']?.radius || undefined;
  }

  @memo
  @HostBinding('class.sent')
  get isAuthor() {
    return isAuthorTag(this.store.account.tag, this.ref);
  }

  @memo
  get isRecipient() {
    return hasTag(this.store.account.mailbox, this.ref);
  }

  saveRef() {
    this.store.view.preloadRef(this.ref, this.repostRef);
  }

  showIcon(i: Icon) {
    return this.visible(i) && this.active(i);
  }

  visible(v: Visibility) {
    return visible(v, this.isAuthor, this.isRecipient);
  }

  active(a: TagAction | ResponseAction | Icon) {
    return active(this.ref, a);
  }
}
