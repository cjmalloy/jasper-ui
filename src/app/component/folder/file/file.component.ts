import {
  AsyncPipe
} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  forwardRef,
  inject,
  input,
  linkedSignal,
  signal,
  effect,
  untracked
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of, throwError } from 'rxjs';
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
import { CssUrlPipe } from '../../../pipe/css-url.pipe';
import { ThumbnailPipe } from '../../../pipe/thumbnail.pipe';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { AuthzService } from '../../../service/authz.service';
import { Store } from '../../../store/store';
import { getTitle, templates } from '../../../util/format';
import { getScheme } from '../../../util/http';
import { hasTag, isAuthorTag, repost } from '../../../util/tag';
import { ViewerComponent } from '../../viewer/viewer.component';

@Component({
  selector: 'app-file',
  templateUrl: './file.component.html',
  styleUrls: ['./file.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'tabindex': '0' },
  imports: [
    forwardRef(() => ViewerComponent),
    RouterLink,
    AsyncPipe,
    ThumbnailPipe,
    CssUrlPipe,
  ],
})
export class FileComponent {
  css = 'file ';
  private destroyRef = inject(DestroyRef);

  readonly refInput = input.required<Ref>({ alias: 'ref' });
  readonly refSignal = linkedSignal(() => this.refInput());
  get ref() { return this.refSignal(); }
  set ref(value: Ref) { this.refSignal.set(value); }
  readonly expanded = input(false);
  readonly expandInline = input(false);
  readonly showToggle = input(false);
  readonly dragging = input(false);
  readonly fetchRepost = input(true);

  private readonly repostRefSignal = signal<Ref | undefined>(undefined);
  private readonly expandPluginsSignal = signal<string[]>([]);
  icons: Icon[] = [];
  actions: Action[] = [];
  editing = false;
  viewSource = false;
  writeAccess = false;
  taggingAccess = false;
  serverError: string[] = [];

  get repostRef() { return this.repostRefSignal(); }
  set repostRef(value: Ref | undefined) { this.repostRefSignal.set(value); }

  get expandPlugins() { return this.expandPluginsSignal(); }
  set expandPlugins(value: string[]) { this.expandPluginsSignal.set(value); }

  constructor(
    public admin: AdminService,
    private refs: RefService,
    public store: Store,
    private auth: AuthzService,
  ) {
    effect(() => {
      this.refInput();
      untracked(() => this.loadRef());
    });
  }

  private loadRef() {
    this.editing = false;
    this.viewSource = false;
    this.writeAccess = this.auth.writeAccess(this.ref);
    this.taggingAccess = this.auth.taggingAccess(this.ref);
    this.icons = uniqueConfigs(sortOrder(this.admin.getIcons(this.ref.tags, this.ref.plugins, getScheme(this.ref.url))));
    this.actions = uniqueConfigs(sortOrder(this.admin.getActions(this.ref.tags, this.ref.plugins)));

    this.expandPlugins = this.admin.getEmbeds(this.ref);
    if (this.repost() && this.ref && this.fetchRepost() && this.repostRef?.url != repost(this.ref)) {
      (this.store.view.top?.url === this.ref.sources![0]
          ? of(this.store.view.top)
          : this.refs.getCurrent(this.url())
      ).pipe(
        catchError(err => err.status === 404 ? of(undefined) : throwError(() => err)),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe(ref => {
        this.repostRef = ref;
        if (!ref) return;
        if (this.bareRepost()) {
          this.expandPlugins = this.admin.getEmbeds(ref);
        } else {
          this.expandPlugins = [...this.expandPlugins, 'plugin/repost'];
        }
      });
    }
  }

  readonly pluginClasses = computed(() => {
    return this.css + templates(this.ref.tags, 'plugin')
      .map(t => t.replace(/\//g, '_').replace(/\./g, '-'))
      .join(' ');
  });
  readonly nonLocalOrigin = computed(() => {
    if (this.ref.origin === this.store.account.origin) return undefined;
    return this.ref.origin || '';
  });
  readonly local = computed(() => {
    return this.ref.origin === this.store.account.origin;
  });
  readonly repost = computed(() => {
    return this.ref?.sources?.[0] && hasTag('plugin/repost', this.ref);
  });
  readonly bareRepost = computed(() => {
    return this.repost() && !this.ref.title && !this.ref.comment;
  });
  readonly url = computed(() => {
    return this.repost() ? this.ref.sources![0] : this.ref.url;
  });
  readonly title = computed(() => {
    if (this.bareRepost()) return getTitle(this.repostRef) || $localize`Repost`;
    return getTitle(this.ref);
  });
  readonly thumbnail = computed(() => {
    if (!this.admin.getPlugin('plugin/thumbnail')) return false;
    return hasTag('plugin/thumbnail', this.ref) || hasTag('plugin/thumbnail', this.repostRef);
  });
  readonly iconColor = computed(() => {
    if (!this.thumbnail()) return '';
    return this.ref?.plugins?.['plugin/thumbnail']?.color || this.repostRef?.plugins?.['plugin/thumbnail']?.color || '';
  });
  readonly iconEmoji = computed(() => {
    if (!this.thumbnail()) return '';
    return this.ref?.plugins?.['plugin/thumbnail']?.emoji || this.repostRef?.plugins?.['plugin/thumbnail']?.emoji || '';
  });
  readonly iconEmojiDefaults = computed(() => {
    const icon = this.icons.filter(i => i.thumbnail || (i.label && (i.order || 0) >= 0) && this.showIcon(i))[0];
    return icon?.label || icon?.thumbnail;
  });
  readonly iconRadius = computed(() => {
    return this.ref?.plugins?.['plugin/thumbnail']?.radius || this.repostRef?.plugins?.['plugin/thumbnail']?.radius || undefined;
  });
  readonly isAuthor = computed(() => {
    return isAuthorTag(this.store.account.tag, this.ref);
  });
  readonly isRecipient = computed(() => {
    return hasTag(this.store.account.mailbox, this.ref);
  });

  saveRef() {
    this.store.view.preloadRef(this.ref, this.repostRef);
  }

  showIcon(i: Icon) {
    return this.visible(i) && this.active(i);
  }

  visible(v: Visibility) {
    return visible(this.ref, v, this.isAuthor(), this.isRecipient());
  }

  active(a: TagAction | ResponseAction | Icon) {
    return active(this.ref, a);
  }
}
