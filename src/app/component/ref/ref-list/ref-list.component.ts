import {
  afterNextRender,
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  forwardRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  viewChildren
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { isEqual } from 'lodash-es';
import { DateTime } from 'luxon';
import { catchError, forkJoin, map, Observable, of, startWith, switchMap } from 'rxjs';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Ext } from '../../../model/ext';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';
import { score } from '../../../mods/vote';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { cursorPage } from '../../../util/cursor-page';
import { withStableDateSort } from '../../../util/query';
import { hasPrefix } from '../../../util/tag';
import { LoadingComponent } from '../../loading/loading.component';
import { PageControlsComponent } from '../../page-controls/page-controls.component';
import { RefComponent } from '../ref.component';

interface MorePages {
  base?: Page<Ref>;
  pages: Page<Ref>[];
  loading: boolean;
  error: boolean;
}

const NO_MORE: MorePages = { pages: [], loading: false, error: false };

function refKey(ref: Ref) {
  return ref.origin + '@' + ref.url;
}

@Component({
  selector: 'app-ref-list',
  templateUrl: './ref-list.component.html',
  styleUrls: ['./ref-list.component.scss'],
  host: { 'class': 'ref-list' },
  imports: [
    forwardRef(() => RefComponent),
    PageControlsComponent,
    LoadingComponent,
  ],
})
export class RefListComponent implements HasChanges {
  private accounts = inject(AccountService);
  private admin = inject(AdminService);
  private router = inject(Router);
  private store = inject(Store);
  private refs = inject(RefService);
  private query = inject(QueryStore);

  private destroyRef = inject(DestroyRef);

  readonly hide = input<number[]>();
  readonly plugins = input<string[]>();
  readonly showPageLast = input(true);
  readonly showAlarm = input(true);
  readonly pageControls = input(true);
  readonly emptyMessage = input($localize`No results found`);
  readonly showToggle = input(true);
  readonly expandInline = input(false);
  readonly showVotes = input(false);
  readonly hideNewZeroVoteScores = input(true);
  readonly newRefs$ = input<Observable<Ref | undefined>>();
  readonly insertNewAtTop = input(false);
  readonly showPrev = input(true);

  readonly list = viewChildren(RefComponent);
  private readonly moreEl = viewChild<ElementRef<HTMLElement>>('more');

  readonly pinned = toSignal(toObservable(computed(() => this.ext()?.config?.pinned as string[] | undefined)).pipe(
    switchMap(pins => pins?.length ? forkJoin(pins.map(pin => this.refs.getCurrent(pin).pipe(
      catchError(() => of({ url: pin } as Ref)),
    ))).pipe(startWith([] as Ref[])) : of([] as Ref[])),
  ), { initialValue: [] as Ref[] });
  readonly newRefs = signal<Ref[]>([]);

  readonly page = input<Page<Ref> | undefined>(undefined);
  readonly ext = input<Ext | undefined>(undefined);
  readonly colsInput = input<number | undefined>(undefined, { alias: 'cols' });
  readonly expandedInput = input<boolean | undefined>(undefined, { alias: 'expanded' });

  constructor() {
    effect(() => {
      const page = this.page();
      if (!page) return;
      untracked(() => this.checkPage(page));
    });
    // Syncs the infinite scroll sentinel with an IntersectionObserver
    afterRenderEffect(onCleanup => {
      const el = this.moreEl()?.nativeElement;
      if (!el || this.loadingMore() || !('IntersectionObserver' in window)) return;
      const observer = new IntersectionObserver(entries => {
        if (!entries.some(e => e.isIntersecting)) return;
        observer.disconnect();
        this.loadMore();
      }, { rootMargin: '100% 0px' });
      observer.observe(el);
      onCleanup(() => observer.disconnect());
    });
  }

  saveChanges() {
    return !this.list()?.find(r => !r.saveChanges());
  }


  readonly colStyle = computed(() => {
    if (!this.cols()) {
      return '';
    } else {
      return ' 1fr'.repeat(this.cols());
    }
  });

  readonly cols = computed(() => {
    if (this.colsInput()) return this.colsInput();
    return this.ext()?.config?.defaultCols;
  });

  readonly expanded = computed<boolean>(() => {
    if (this.expandedInput() === undefined) return !!this.ext()?.config?.defaultExpanded;
    return this.expandedInput()!;
  });


  private readonly more = signal<MorePages>(NO_MORE);

  /**
   * Pages loaded by infinite scroll after the current page, discarded when the current page changes.
   */
  private readonly morePages = computed(() => {
    const more = this.more();
    return more.base && more.base === this.page() ? more : NO_MORE;
  });

  /**
   * Infinite scroll is enabled by the infinite query param, then the ext config, then the config/infinite template.
   */
  readonly infiniteScroll = computed(() => {
    if (!this.pageControls()) return false;
    const template = this.admin.getTemplate('config/infinite');
    if (!template) return false;
    const ext = this.ext();
    return this.store.view.infinite()
      ?? (ext?.modifiedString ? ext.config?.defaultInfinite : undefined)
      ?? this.subTemplateInfinite()
      ?? ext?.config?.defaultInfinite
      ?? template.config?.defaultInfinite
      ?? true;
  });

  /**
   * Templates for sub tags, such as plugin/image/masonry, restyle the parent tag's list,
   * so let them set its infinite scroll default. The deepest template wins.
   */
  private readonly subTemplateInfinite = computed<boolean | undefined>(() => {
    const tag = this.ext()?.tag;
    if (!tag) return undefined;
    return Object.values(this.admin.status().templates)
      .filter(t => t && t.tag !== tag && hasPrefix(t.tag, tag))
      .sort((a, b) => b!.tag.split('/').length - a!.tag.split('/').length)
      .map(t => t!.defaults?.defaultInfinite ?? t!.config?.defaultInfinite)
      .find(v => v !== undefined);
  });

  /**
   * With infinite scroll the page controls can't be reached, so show the column selector above the list.
   */
  readonly infiniteControls = computed(() =>
    this.infiniteScroll() && !!this.page()?.content.length && (this.cols() !== undefined || !!this.store.view.cols()));

  readonly loadingMore = computed(() => this.morePages().loading);

  readonly moreRefs = computed(() => {
    const seen = new Set([...this.page()?.content || [], ...this.newRefs()].map(refKey));
    return this.morePages().pages
      .flatMap(p => p.content)
      .filter(ref => {
        const key = refKey(ref);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  });

  readonly lastPage = computed(() => this.morePages().pages.at(-1) || this.page());

  readonly hasMore = computed(() => {
    const page = this.page();
    const last = this.lastPage();
    if (!this.infiniteScroll() || !page || !last || this.morePages().error) return false;
    const args = this.query.args();
    if (!args || !isEqual(args, this.query.pageArgs())) return false;
    if (page !== this.query.page() || !last.content.length) return false;
    return last.page.number < last.page.totalPages - 1;
  });

  /**
   * Keep the loading slot mounted once infinite scroll has started on this page,
   * so the page controls don't jump when the last request completes or fails.
   */
  readonly moreSpacer = computed(() => this.hasMore() || !!this.morePages().base);

  loadMore() {
    const base = this.page();
    const args = this.query.args();
    const last = this.lastPage();
    if (!this.hasMore() || this.loadingMore() || !base || !args || !last) return;
    const pending: MorePages = { ...this.morePages(), base, loading: true };
    this.more.set(pending);
    const target = last.page.number + 1;
    const request = cursorPage(this.refs, last, args, target)
      ?? this.refs.page(withStableDateSort({ ...args, page: target }));
    request.pipe(
      map(page => ({ page, error: false })),
      catchError(() => of({ page: undefined, error: true })),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(({ page, error }) => {
      this.more.update(more => more !== pending ? more : {
        base,
        pages: page ? [...more.pages, page] : more.pages,
        loading: false,
        error,
      });
    });
  }

  moreNumber(ref: Ref, i: number) {
    if (this.showVotes()) return score(ref);
    const page = this.page()!;
    return i + page.content.length + page.page.number * page.page.size + 1;
  }

  private checkPage(page: Page<Ref>) {
    if (page) {
      if (page.page.number > 0 && page.page.number >= page.page.totalPages) {
        this.router.navigate([], {
          queryParams: {
            pageNumber: page.page.totalPages - 1,
          },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    }
  }

  private readonly initialize = afterNextRender(() => {
    this.newRefs$()?.pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(ref => {
      if (ref) this.addNewRef(ref);
    });
  });


  getNumber(i: number) {
    if (this.showVotes()) {
      const votes = score(this.page()!.content[i]);
      if (votes < 100 &&
        this.hideNewZeroVoteScores() &&
        DateTime.now().diff(this.page()!.content[i].created!, 'minutes').minutes < 5) {
        return '•';
      }
      return votes;
    }
    return i + this.page()!.page.number * this.page()!.page.size + 1;
  }

  addNewRef(ref: Ref) {
    // TODO: verify read before clearing?
    this.accounts.clearNotificationsIfNone(ref.modified, ref.origin);
    if (ref.url !== this.store.view.url() && !this.page()?.content.find(r => r.url === ref.url) && !this.moreRefs().find(r => refKey(r) === refKey(ref))) {
      const index = this.newRefs().findIndex(r => r.url === ref.url);
      if (index !== -1) {
        this.newRefs.update(newRefs => newRefs.map((r, i) => i === index ? ref : r));
      } else if (this.insertNewAtTop()) {
        this.newRefs.set([ref, ...this.newRefs()]);
        return;
      } else {
        this.newRefs.update(refs => [...refs, ref]);
        return;
      }
    }
    this.store.eventBus.refresh(ref);
  }
}
