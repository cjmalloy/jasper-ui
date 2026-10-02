import { DestroyRef, inject, Component, OnInit, ChangeDetectionStrategy, effect, input, signal, viewChildren } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, forkJoin, Observable, of } from 'rxjs';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Ext } from '../../model/ext';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { AccountService } from '../../service/account.service';
import { RefService } from '../../service/api/ref.service';
import { Store } from '../../store/store';
import { LoadingComponent } from '../loading/loading.component';
import { PageControlsComponent } from '../page-controls/page-controls.component';
import { RefComponent } from '../ref/ref.component';
import { NoteComponent } from './note/note.component';

@Component({
  selector: 'app-notebook',
  templateUrl: './notebook.component.html',
  styleUrl: './notebook.component.scss',
  host: { 'class': 'notebook ext' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NoteComponent,
    PageControlsComponent,
    LoadingComponent,
  ],
})
export class NotebookComponent implements OnInit, HasChanges {
  private destroyRef = inject(DestroyRef);

  readonly hide = input<number[]>();
  readonly plugins = input<string[]>();
  readonly showPageLast = input(true);
  readonly showAlarm = input(true);
  readonly pageControls = input(true);
  readonly emptyMessage = input('No results found');
  readonly showToggle = input(true);
  readonly expandInline = input(false);
  readonly showVotes = input(false);
  readonly hideNewZeroVoteScores = input(true);
  readonly newRefs$ = input<Observable<Ref | undefined>>();
  readonly showPrev = input(true);

  readonly list = viewChildren(RefComponent);

  private readonly pinnedSignal = signal<Ref[]>([]);
  private readonly newRefsSignal = signal<Ref[]>([]);

  get pinned() { return this.pinnedSignal(); }
  set pinned(value: Ref[]) { this.pinnedSignal.set(value); }

  get newRefs() { return this.newRefsSignal(); }
  set newRefs(value: Ref[]) { this.newRefsSignal.set(value); }

  readonly extInput = input<Ext | undefined>(undefined, { alias: 'ext' });
  readonly colsInput = input<number | undefined>(undefined, { alias: 'cols' });
  readonly expandedInput = input<boolean | undefined>(undefined, { alias: 'expanded' });
  readonly pageInput = input<Page<Ref> | undefined>(undefined, { alias: 'page' });

  constructor(
    private accounts: AccountService,
    private router: Router,
    private store: Store,
    private refs: RefService,
  ) {
    effect(() => {
      const value = this.extInput();
      if (!value?.config?.pinned?.length) {
        this.pinned = [];
      } else {
        forkJoin((value.config.pinned as string[])
          .map(pin => this.refs.getCurrent(pin).pipe(
            catchError(err => of({ url: pin })),
            takeUntilDestroyed(this.destroyRef),
          )))
          .subscribe(pinned => this.pinned = pinned);
      }
    });
    effect(() => {
      const page = this.pageInput();
      if (page && page.page.number !== undefined && page.page.number > 0 && page.page.number >= page.page.totalPages) {
        this.router.navigate([], {
          queryParams: {
            pageNumber: page.page.totalPages - 1,
          },
          queryParamsHandling: 'merge',
        });
      }
    });
  }

  saveChanges() {
    return !this.list()?.find(r => !r.saveChanges());
  }

  get ext() {
    return this.extInput();
  }

  get colStyle() {
    if (!this.cols) {
      return '';
    } else {
      return ' 1fr'.repeat(this.cols);
    }
  }

  get cols() {
    if (this.colsInput()) return this.colsInput();
    return this.ext?.config?.defaultCols;
  }

  get expanded(): boolean {
    if (this.expandedInput() === undefined) return this.ext?.config?.defaultExpanded;
    return this.expandedInput()!;
  }

  get page(): Page<Ref> | undefined {
    return this.pageInput();
  }

  ngOnInit(): void {
    this.newRefs$()?.pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(ref => ref && this.addNewRef(ref));
  }


  addNewRef(ref: Ref) {
    // TODO: verify read before clearing?
    this.accounts.clearNotificationsIfNone(ref.modified);
    if (!this.page?.content.find(r => r.url === ref.url)) {
      const index = this.newRefs.findIndex(r => r.url === ref.url);
      if (index !== -1) {
        this.newRefs[index] = ref;
      } else {
        this.newRefs = [ref, ...this.newRefs];
        return;
      }
    }
    this.store.eventBus.refresh(ref);
  }
}
