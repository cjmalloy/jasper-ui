import {
  AsyncPipe
} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  linkedSignal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of, startWith, switchMap } from 'rxjs';
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

  readonly refInput = input.required<Ref>({ alias: 'ref' });
  readonly ref = linkedSignal(() => this.refInput());
  readonly expanded = input(false);
  readonly expandInline = input(false);
  readonly showToggle = input(false);
  readonly dragging = input(false);
  readonly fetchRepost = input(true);

  readonly repostRef = toSignal(toObservable(computed(() =>
    this.fetchRepost() && this.repost() ? this.url() : undefined,
  )).pipe(switchMap(url => !url ? of(undefined) :
    (this.store.view.top()?.url === url ? of(this.store.view.top()) : this.refs.getCurrent(url)).pipe(
      catchError(() => of(undefined)),
      startWith(undefined),
    ))), { initialValue: undefined });
  readonly expandPlugins = computed(() => this.bareRepost() && this.repostRef()
    ? this.admin.getEmbeds(this.repostRef())
    : [...this.admin.getEmbeds(this.ref()), ...(this.repostRef() ? ['plugin/repost'] : [])]);
  readonly editing = linkedSignal(() => { this.ref(); return false; });
  readonly viewSource = linkedSignal(() => { this.ref(); return false; });
  readonly icons = computed(() => uniqueConfigs(sortOrder(this.admin.getIcons(this.ref().tags, this.ref().plugins, getScheme(this.ref().url)))));
  readonly actions = computed(() => uniqueConfigs(sortOrder(this.admin.getActions(this.ref().tags, this.ref().plugins))));
  readonly writeAccess = computed(() => this.auth.writeAccess(this.ref()));
  readonly taggingAccess = computed(() => this.auth.taggingAccess(this.ref()));
  readonly serverError = linkedSignal<string[]>(() => { this.ref(); return []; });

  constructor(
    public admin: AdminService,
    private refs: RefService,
    public store: Store,
    private auth: AuthzService,
  ) {}

  readonly pluginClasses = computed(() => {
    return this.css + templates(this.ref().tags, 'plugin')
      .map(t => t.replace(/\//g, '_').replace(/\./g, '-'))
      .join(' ');
  });
  readonly nonLocalOrigin = computed(() => {
    if (this.ref().origin === this.store.account.origin()) return undefined;
    return this.ref().origin || '';
  });
  readonly local = computed(() => {
    return this.ref().origin === this.store.account.origin();
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
  readonly title = computed(() => {
    if (this.bareRepost()) return getTitle(this.repostRef()) || $localize`Repost`;
    return getTitle(this.ref());
  });
  readonly thumbnail = computed(() => {
    if (!this.admin.getPlugin('plugin/thumbnail')) return false;
    return hasTag('plugin/thumbnail', this.ref()) || hasTag('plugin/thumbnail', this.repostRef());
  });
  readonly iconColor = computed(() => {
    if (!this.thumbnail()) return '';
    return this.ref()?.plugins?.['plugin/thumbnail']?.color || this.repostRef()?.plugins?.['plugin/thumbnail']?.color || '';
  });
  readonly iconEmoji = computed(() => {
    if (!this.thumbnail()) return '';
    return this.ref()?.plugins?.['plugin/thumbnail']?.emoji || this.repostRef()?.plugins?.['plugin/thumbnail']?.emoji || '';
  });
  readonly iconEmojiDefaults = computed(() => {
    const icon = this.icons().filter(i => i.thumbnail || (i.label && (i.order || 0) >= 0) && this.showIcon(i))[0];
    return icon?.label || icon?.thumbnail;
  });
  readonly iconRadius = computed(() => {
    return this.ref()?.plugins?.['plugin/thumbnail']?.radius || this.repostRef()?.plugins?.['plugin/thumbnail']?.radius || undefined;
  });
  readonly isAuthor = computed(() => {
    return isAuthorTag(this.store.account.tag(), this.ref());
  });
  readonly isRecipient = computed(() => {
    return hasTag(this.store.account.mailbox(), this.ref());
  });

  saveRef() {
    this.store.view.preloadRef(this.ref(), this.repostRef());
  }

  showIcon(i: Icon) {
    return this.visible(i) && this.active(i);
  }

  visible(v: Visibility) {
    return visible(this.ref(), v, this.isAuthor(), this.isRecipient());
  }

  active(a: TagAction | ResponseAction | Icon) {
    return active(this.ref(), a);
  }
}
