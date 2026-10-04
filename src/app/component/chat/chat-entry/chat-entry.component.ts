import { FakeLinkDirective } from '../../../directive/fake-link.directive';
import { HttpErrorResponse } from '@angular/common/http';
import {
  DestroyRef,
  inject,
  Component,
  forwardRef,
  effect,
  input,
  linkedSignal,
  viewChildren,
  untracked,
  computed,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { uniq } from 'lodash-es';
import { catchError, map, of, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { TitleDirective } from '../../../directive/title.directive';
import { Ref } from '../../../model/ref';
import { deleteNotice } from '../../../mods/delete';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { RefService } from '../../../service/api/ref.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { AuthzService } from '../../../service/authz.service';
import { ConfigService } from '../../../service/config.service';
import { Store } from '../../../store/store';
import { authors, clickableLink, formatAuthor, getNiceTitle } from '../../../util/format';
import { printError } from '../../../util/http';
import { hasTag, localTag, tagOrigin } from '../../../util/tag';
import { ActionComponent } from '../../action/action.component';
import { ConfirmActionComponent } from '../../action/confirm-action/confirm-action.component';
import { InlineTagComponent } from '../../action/inline-tag/inline-tag.component';
import { LoadingComponent } from '../../loading/loading.component';
import { MdComponent } from '../../md/md.component';
import { NavComponent } from '../../nav/nav.component';
import { ViewerComponent } from '../../viewer/viewer.component';
import { RelativePipe } from '../../../pipe/relative.pipe';

@Component({
  selector: 'app-chat-entry',
  templateUrl: './chat-entry.component.html',
  styleUrls: ['./chat-entry.component.scss'],
  host: { 'class': 'chat-entry', '[attr.tabindex]': '0' },
  imports: [
    RelativePipe,
    FakeLinkDirective,
    forwardRef(() => ViewerComponent),
    forwardRef(() => MdComponent),
    RouterLink,
    TitleDirective,
    LoadingComponent,
    NavComponent,
    ConfirmActionComponent,
    InlineTagComponent,
  ],
})
export class ChatEntryComponent {
  private config = inject(ConfigService);
  admin = inject(AdminService);
  store = inject(Store);
  private auth = inject(AuthzService);
  private exts = inject(ExtService);
  private ts = inject(TaggingService);
  private refs = inject(RefService);

  private destroyRef = inject(DestroyRef);

  readonly actionComponents = viewChildren<ActionComponent>('action');

  readonly refInput = input.required<Ref>({ alias: 'ref' });
  readonly ref = linkedSignal(() => this.refInput());
  readonly focused = input(false);
  readonly loading = input(true);

  readonly repostRef = toSignal(toObservable(computed(() => this.bareRepost() ? this.url() : undefined)).pipe(
    switchMap(url => !url ? of(undefined) :
      (this.store.view.top()?.url === url ? of(this.store.view.top()) : this.refs.getCurrent(url)).pipe(
        catchError(() => of(undefined)),
      )),
  ));
  readonly noComment = computed(() => ({ ...this.bareRef(), comment: '' }) as Ref);
  readonly deleted = linkedSignal(() => { this.refInput(); return false; });
  readonly writeAccess = computed(() => this.auth.writeAccess(this.ref()));
  readonly taggingAccess = computed(() => this.auth.taggingAccess(this.ref()));
  readonly deleteAccess = computed(() => this.auth.deleteAccess(this.ref()));
  readonly serverError = linkedSignal<string[]>(() => { this.refInput(); return []; });
  private readonly hovering = linkedSignal(() => { this.refInput(); return false; });

  constructor() {
    effect(() => {
      this.refInput();
      untracked(() => this.actionComponents().forEach(c => c.reset()));
    });
    effect(() => {
      const actionComponents = this.actionComponents();
      if (!this.focused() && !this.hovering()) untracked(() => actionComponents.forEach(c => c.reset()));
    });
  }

  readonly title = computed(() => {
    const title = (this.ref()?.title || '').trim();
    if (title) return title;
    if (this.focused()) return '';
    if (this.bareRepost()) return getNiceTitle(this.repostRef()) || '';
    return getNiceTitle(this.ref());
  });

  readonly allowActions = computed(() => this.hovering() || this.focused() || !!this.actionComponents()?.find(c => c.active()));

  setHovering(value: boolean) {
    this.hovering.set(value);
  }

  readonly nonLocalOrigin = computed(() => {
    if (this.ref().origin === this.store.account.origin()) return undefined;
    return this.ref().origin || '';
  });

  readonly localhost = computed(() => {
    return this.ref().url.startsWith(this.config.base);
  });

  readonly authors = computed(() => {
    const lookup = this.store.origins.originMap().get(this.ref().origin || '');
    return uniq([
      ...this.ref().tags?.filter(t => this.admin.getPlugin(t)?.config?.signature === t) || [],
      ...authors(this.ref()).map(a => !tagOrigin(a) ? a : localTag(a) + (lookup?.get(tagOrigin(a)) ?? tagOrigin(a))),
    ]);
  });

  readonly authorExts = toSignal(toObservable(computed(() => ({
    authors: this.authors(), origin: this.ref().origin || '',
  }))).pipe(switchMap(({ authors, origin }) =>
    this.exts.getCachedExts(authors, origin).pipe(this.admin.authorFallback))));

  readonly tagLink = computed(() => this.url().toLowerCase().startsWith('tag:/'));

  readonly clickableLink = computed(() => clickableLink(this.url()));

  readonly url = computed(() => this.repost() ? this.ref().sources![0] : this.ref().url);

  readonly currentRef = computed(() => this.repost() ? this.repostRef() : this.ref());

  readonly bareRef = computed(() => this.bareRepost() ? this.repostRef() : this.ref());

  readonly repost = computed(() => {
    return this.ref()?.sources?.[0] && hasTag('plugin/repost', this.ref());
  });

  readonly bareRepost = computed(() => this.repost() && !this.ref().title && !this.ref().comment);

  readonly approved = computed(() => hasTag('_moderated', this.currentRef()));

  readonly locked = computed(() => hasTag('locked', this.currentRef()));

  readonly qr = computed(() => hasTag('plugin/qr', this.currentRef()));

  readonly audio = computed(() => hasTag('plugin/audio', this.currentRef()) ||
    this.admin.getPluginsForUrl(this.url()).some(p => p.tag === 'plugin/audio'));

  readonly video = computed(() => hasTag('plugin/video', this.currentRef()) ||
    this.admin.getPluginsForUrl(this.url()).some(p => p.tag === 'plugin/video'));

  readonly image = computed(() => hasTag('plugin/image', this.currentRef()) ||
    this.admin.getPluginsForUrl(this.url()).some(p => p.tag === 'plugin/image'));

  readonly media = computed(() => this.qr() || this.audio() || this.video() || this.image());

  readonly expand = computed(() => this.currentRef()?.comment || this.media());

  readonly comments = computed(() => {
    if (!this.admin.getPlugin('plugin/comment')) return 0;
    return this.ref().metadata?.plugins?.['plugin/comment'] || 0;
  });

  readonly chatroom = computed(() => {
    return this.admin.getPlugin('plugin/chat') && hasTag('plugin/chat', this.ref());
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

  formatAuthor(user: string) {
    if (this.store.account.origin() && tagOrigin(user) === this.store.account.origin()) {
      user = user.replace(this.store.account.origin(), '');
    }
    return formatAuthor(user);
  }

  saveRef() {
    this.store.view.preloadRef(this.ref(), this.repostRef());
  }

  tag$ = (tag: string) => {
    this.serverError.set([]);
    return this.store.eventBus.runAndReload$(this.ts.create(tag, this.ref().url, this.ref().origin!), this.ref());
  }

  approve() {
    this.refs.patch(this.ref().url, this.ref().origin!, this.ref().modifiedString!, [{
      op: 'add',
      path: '/tags/-',
      value: '_moderated',
    }]).pipe(
      switchMap(() => this.refs.get(this.ref().url, this.ref().origin!)),
      catchError((err: HttpErrorResponse) => {
        this.serverError.set(printError(err));
        return throwError(() => err);
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(ref => {
      this.serverError.set([]);
      this.ref.set(ref);
    });
  }

  forceDelete$ = () => {
    this.serverError.set([]);
    return this.refs.delete(this.ref().url, this.ref().origin).pipe(
      tap(() => this.deleted.set(true)),
      catchError((err: HttpErrorResponse) => {
        this.serverError.set(printError(err));
        return throwError(() => err);
      }),
    );
  }

  delete$ = () => {
    this.serverError.set([]);
    return (this.admin.getPlugin('plugin/delete')
        ? this.refs.update(deleteNotice(this.ref()))
        : this.refs.delete(this.ref().url, this.ref().origin).pipe(map(() => ''))
    ).pipe(
      tap(() => this.deleted.set(true)),
      catchError((err: HttpErrorResponse) => {
        this.serverError.set(printError(err));
        return throwError(() => err);
      }),
    );
  }

}
