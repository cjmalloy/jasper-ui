import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FakeLinkDirective } from '../../directive/fake-link.directive';
import { Component, ElementRef, forwardRef, ChangeDetectionStrategy, effect, input, linkedSignal, signal, computed, untracked, afterNextRender, DestroyRef, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { uniq, uniqBy } from 'lodash-es';
import { catchError, filter, finalize, forkJoin, map, of, Subject, switchMap } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { Ext } from '../../model/ext';
import { Plugin } from '../../model/plugin';
import { hydrate } from '../../model/tag';
import { getTemplateScope, Template } from '../../model/template';
import { getMailbox } from '../../mods/mailbox';
import { RootConfig } from '../../mods/root';
import { UserConfig } from '../../mods/user';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { TaggingService } from '../../service/api/tagging.service';
import { TemplateService } from '../../service/api/template.service';
import { AuthzService } from '../../service/authz.service';
import { ConfigService } from '../../service/config.service';
import { HelpService } from '../../service/help.service';
import { QueryStore } from '../../store/query';
import { Store } from '../../store/store';
import { encodeBookmarkParams } from '../../util/http';
import { hasPrefix, hasTag, isQuery, localTag, setProtected, setPublic, topAnds } from '../../util/tag';
import { BulkComponent } from '../bulk/bulk.component';
import { ChatVideoComponent } from '../chat/chat-video/chat-video.component';
import { ChatComponent } from '../chat/chat.component';
import { DebugComponent } from '../debug/debug.component';
import { ExtComponent } from '../ext/ext.component';
import { FilterComponent } from '../filter/filter.component';
import { MdComponent } from '../md/md.component';
import { NavComponent } from '../nav/nav.component';
import { QueryComponent } from '../query/query.component';
import { SearchComponent } from '../search/search.component';
import { SortComponent } from '../sort/sort.component';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  host: {
    'class': 'sidebar',
    '[class.floating]': 'floating()',
    '[class.expanded]': 'expanded()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FakeLinkDirective,
    ExtComponent,
    forwardRef(() => MdComponent),
    SearchComponent,
    QueryComponent,
    FilterComponent,
    SortComponent,
    DebugComponent,
    BulkComponent,
    RouterLink,
    ChatComponent,
    NavComponent,
    RouterLinkActive,
    ChatVideoComponent,
  ]
})
export class SidebarComponent {
  private destroy$ = new Subject<void>();

  readonly tagInput = input('', { alias: 'tag' });
  readonly tag = linkedSignal(() => this.tagInput() || this.ext()?.tag || '');
  readonly activeExts = input<Ext[]>([]);
  readonly showToggle = input(true);
  readonly home = input(false);
  readonly floating = input(true);

  readonly localTag = computed(() => this.tag() ? localTag(this.tag()) : undefined);
  readonly plugin = computed(() => this.tag() ? this.admin.getPlugin(this.tag()) : undefined);
  readonly mailPlugin = computed(() => this.tag() ? this.admin.getPlugin(getMailbox(this.tag(), this.store.account.origin())) : undefined);
  readonly tagTemplate = computed(() => this.tag() ? this.admin.getTemplate(this.tag()) : undefined);
  readonly addTags = computed(() => {
    let tags = this.rootConfig()?.addTags || this.plugin()?.config?.reply || ['public'];
    if (this.tag() && !this.home()) {
      tags = this.plugin() ? uniq([
        ...tags, ...this.plugin()?.config?.submit ? [this.plugin()!.tag] : [],
        ...this.plugin()?.config?.internal ? ['internal'] : [],
      ]) : uniq([...this.rootConfig()?.addTags || ['public'], ...topAnds(this.tag()).map(localTag)]);
    }
    return tags.filter(tag => this.auth.canAddTag(tag));
  });
  readonly template = toSignal(toObservable(computed(() => {
    const tag = this.store.view.template();
    return tag && !isQuery(tag) ? tag + this.store.account.origin() : undefined;
  })).pipe(switchMap(tag => tag ? this.templates.get(tag).pipe(
    catchError(() => of(undefined)),
  ) : of(undefined))), { initialValue: undefined });
  readonly writeAccess = computed(() => !!this.tag() && this.auth.tagWriteAccess(this.tag()));
  readonly ui = computed(() => this.tag() ? this.admin.getTemplateUi(this.tag()) : []);
  genUrl = 'internal:' + uuid();

  readonly savingBookmark = signal(false);
  readonly savingSub = signal(false);
  readonly savingAlarm = signal(false);

  readonly ext = input<Ext | undefined>(undefined);
  readonly expandedInput = input(false, { alias: 'expanded' });
  readonly expanded = linkedSignal<{ input: boolean; stored: boolean }, boolean>({
    source: () => ({ input: this.expandedInput(), stored: this.store.view.sidebarExpanded() }),
    computation: (source, previous) => previous && previous.source.input === source.input ? source.stored : source.input,
  });
  private lastView = this.store.view.current();

  constructor(
    public router: Router,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
    public config: ConfigService,
    private auth: AuthzService,
    private account: AccountService,
    public ts: TaggingService,
    private exts: ExtService,
    private templates: TemplateService,
    private el: ElementRef,
    private help: HelpService,
  ) {
    effect(() => {
      this.home();
      this.tagInput();
      this.ext();
      untracked(() => this.update());
    });
    if (localStorage.getItem('sidebar-expanded') !== null) {
      this.expanded.set(localStorage.getItem('sidebar-expanded') !== 'false');
    } else {
      this.expanded.set(window.matchMedia && !!window.matchMedia('(min-width: 1024px)').matches);
    }

    router.events.pipe(
      filter(event => event instanceof NavigationEnd),
    ).subscribe(() => {
      if (this.chat()) return;
      if (this.config.tablet && this.lastView != this.store.view.current() ||
        !this.config.huge  && this.store.view.current() === 'ref/summary') {
        this.lastView = this.store.view.current();
        this.expanded.set(false);
      }
    });
    effect(() => {
      const value = this.ext();
      this.store.view.floatingSidebar.set(!value?.config?.noFloatingSidebar && value?.config?.defaultCols === undefined);
    });
    effect(() => {
      const value = this.expanded();
      localStorage.setItem('sidebar-expanded', ''+value);
      this.store.view.sidebarExpanded.set(value);
    });
  }

  private readonly initializeView = afterNextRender(() => {
    if (this.ext()?.config?.searchHelp) {
      this.help.pushStep(this.el.nativeElement.querySelector('app-search'), this.ext()!.config.searchHelp);
    }
    if (this.ext()?.config?.filterHelp) {
      this.help.pushStep(this.el.nativeElement.querySelector('app-filter'), this.ext()!.config.filterHelp);
    }
    if (this.ext()?.config?.sortHelp) {
      this.help.pushStep(this.el.nativeElement.querySelector('app-sort'), this.ext()!.config.sortHelp);
    }
  });

  private update() {
    if (this.ext()) {
      if (this.ext()!.config?.searchHelp) {
        this.help.pushStep(this.el.nativeElement.querySelector('app-search'), this.ext()!.config.searchHelp);
      }
      if (this.ext()!.config?.filterHelp) {
        this.help.pushStep(this.el.nativeElement.querySelector('app-filter'), this.ext()!.config.filterHelp);
      }
      if (this.ext()!.config?.sortHelp) {
        this.help.pushStep(this.el.nativeElement.querySelector('app-sort'), this.ext()!.config.sortHelp);
      }
    }
  }

  private readonly destroyCleanup = inject(DestroyRef).onDestroy(() => {
    this.destroy$.next();
    this.destroy$.complete();
  });
  readonly local = computed(() => {
    return !this.existing() || this.ext()?.origin === this.store.account.origin();
  });

  readonly existing = computed(() => {
    return this.ext()?.modified;
  });

  readonly root = computed(() => {
    return !!this.admin.getTemplate('');
  });
  readonly rootConfig = computed(() => {
    if (!this.root()) return undefined;
    return (this.ext()?.config || this.tagTemplate()?.defaults || this.admin.getTemplate('')!.defaults) as RootConfig;
  });
  readonly modmail = computed(() => {
    return !this.store.view.query() && this.rootConfig()?.modmail;
  });
  readonly dm = computed(() => {
    return this.admin.getTemplate('dm') && this.store.view.current() === 'inbox/dms';
  });
  readonly dms = computed(() => {
    return uniq([
      ...this.plugin()?.config?.reply ? [ this.plugin()!.tag ] : [],
      ...this.rootConfig()?.dms ? [this.rootConfig()?.dms] : [],
    ]);
  });
  readonly canAddTag = computed(() => {
    return !this.plugin()?.tag || this.auth.canAddTag(this.plugin()!.tag);
  });
  readonly videoChat = computed(() => {
    return !!this.admin.getPlugin('plugin/user/video') && (this.chat() || hasPrefix(this.ext()?.tag || this.tag(), 'chat'));
  });
  readonly chat = computed(() => {
    return !!this.admin.getPlugin('plugin/user/lobby') && !!this.admin.getPlugin('plugin/chat') && hasTag('plugin/chat', this.store.view.ref());
  });
  readonly user = computed(() => {
    return !this.store.view.query() && !!this.admin.getTemplate('user') && hasPrefix(this.tag(), 'user') && !this.store.view.userTemplate();
  });
  readonly inbox = computed(() => {
    return setPublic(this.tag());
  });
  readonly outbox = computed(() => {
    return setProtected(this.tag());
  });
  readonly userConfig = computed(() => {
    if (!this.user() && !this.home()) return null;
    return this.store.account.ext()?.config as UserConfig;
  });
  readonly bookmarkExts = toSignal(toObservable(computed(() =>
    this.ext() ? this.store.account.bookmarkQueries() : [])).pipe(
    switchMap(tags => this.exts.getCachedExts(tags).pipe(this.admin.extFallbacks)),
  ), { initialValue: [] });
  readonly userSubs = computed(() => {
    return this.userConfig()?.subscriptions?.filter((s: string) => hasPrefix(s, 'user'));
  });
  readonly userSubExts = toSignal(toObservable(computed(() =>
    this.ext() ? this.userSubs() || [] : [])).pipe(
    switchMap(tags => this.exts.getCachedExts(tags).pipe(this.admin.extFallbacks)),
  ), { initialValue: [] });
  readonly tagSubs = computed(() => {
    return this.userConfig()?.subscriptions?.filter((s: string) => !hasPrefix(s, 'user'));
  });
  readonly tagSubExts = toSignal(toObservable(computed(() =>
    this.ext() ? this.tagSubs() || [] : [])).pipe(
    switchMap(tags => this.exts.getCachedExts(tags).pipe(this.admin.extFallbacks)),
  ), { initialValue: [] });
  readonly queryExts = toSignal(toObservable(this.store.view.exts).pipe(
    switchMap(exts => {
    if (!exts.length) return of([]);
    return forkJoin(exts.map(x => this.exts.page({
      query: x.tag,
      sort: ['origin', 'tag:len', 'tag', 'modified,DESC'],
      size: x.config?.childTags || 5,
    }).pipe(
      map(page => ({
        x: x,
        children: uniqBy(page.content, c => c.tag).filter(c => c.tag !== x.tag),
        more: page.page.totalPages > 1,
      })),
      map(res => res.children.length ? res : null),
      catchError(() => of(null))
    ))).pipe(
      map(ress => ress.filter(res => !!res)),
    );
    }),
  ), { initialValue: [] });
  readonly messages = computed(() => {
    if (!this.admin.getPlugin('plugin/inbox')) return false;
    if (!this.admin.getTemplate('dm')) return false;
    if (!this.store.account.user()) return false;
    return this.dm() || this.user() || this.modmail() || this.dms().length;
  });
  readonly notes = computed(() => {
    return this.admin.getTemplate('notes') && this.store.account.user();
  });
  readonly homeWriteAccess = computed(() => {
    return this.home() && this.admin.home() && this.auth.tagWriteAccess('config/home');
  });
  readonly uiMarkdown = computed(() => {
    if (!this.ext()) return '';
    return this.ui().map(t => hydrate(t.config, 'ui', getTemplateScope(this.store.account.roles(), t, this.ext()!, this.el.nativeElement))).join();
  });

  subscribe() {
    this.savingSub.set(true);
    this.account.addSub$(this.tag()!).pipe(
      finalize(() => this.savingSub.set(false)),
    ).subscribe();
  }

  unsubscribe() {
    this.savingSub.set(true);
    this.account.removeSub$(this.tag()!).pipe(
      finalize(() => this.savingSub.set(false)),
    ).subscribe();
  }

  addBookmark() {
    this.savingBookmark.set(true);
    this.account.addBookmark$(this.bookmark()).pipe(
      finalize(() => this.savingBookmark.set(false)),
    ).subscribe();
  }

  removeBookmark() {
    this.savingBookmark.set(true);
    this.account.removeBookmark$(this.bookmark()).pipe(
      finalize(() => this.savingBookmark.set(false)),
    ).subscribe();
  }

  addAlarm() {
    this.savingAlarm.set(true);
    this.account.addAlarm$(this.tag()!).pipe(
      finalize(() => this.savingAlarm.set(false)),
    ).subscribe();
  }

  removeAlarm() {
    this.savingAlarm.set(true);
    this.account.removeAlarm$(this.tag()!).pipe(
      finalize(() => this.savingAlarm.set(false)),
    ).subscribe();
  }

  readonly inSubs = computed(() => {
    return this.store.account.subs().includes(this.tag()!);
  });

  readonly bookmark = computed(() => {
    const qs = encodeBookmarkParams(this.router.url);
    return qs ? `${this.tag()}?${qs}` : this.tag()!;
  });

  readonly inBookmarks = computed(() => {
    return this.store.account.bookmarks().includes(this.bookmark());
  });

  readonly inAlarms = computed(() => {
    return this.store.account.alarms().includes(this.tag()!);
  });

  set showRemotes(value: boolean) {
    this.router.navigate([], { queryParams: { showRemotes: value ? true : null }, queryParamsHandling: 'merge' })
  }

  startChat() {
    this.store.view.ref.update(ref => ref ? { ...ref, tags: uniq([...ref.tags || [], 'plugin/chat']) } : ref);
    this.ts.create('plugin/chat', this.store.view.ref()!.url, this.store.account.origin()).subscribe();
  }
}
