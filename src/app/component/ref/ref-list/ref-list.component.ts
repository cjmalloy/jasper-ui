import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  forwardRef,
  inject,
  input,
  signal,
  untracked,
  viewChildren
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { DateTime } from 'luxon';
import { catchError, forkJoin, Observable, of, startWith, switchMap } from 'rxjs';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Ext } from '../../../model/ext';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';
import { score } from '../../../mods/vote';
import { AccountService } from '../../../service/account.service';
import { RefService } from '../../../service/api/ref.service';
import { Store } from '../../../store/store';
import { LoadingComponent } from '../../loading/loading.component';
import { PageControlsComponent } from '../../page-controls/page-controls.component';
import { RefComponent } from '../ref.component';

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
  private router = inject(Router);
  private store = inject(Store);
  private refs = inject(RefService);

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
    this.accounts.clearNotificationsIfNone(ref.modified);
    if (ref.url !== this.store.view.url() && !this.page()?.content.find(r => r.url === ref.url)) {
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
