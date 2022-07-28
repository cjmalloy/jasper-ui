import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { combineLatest, map, Subject, switchMap, takeUntil } from 'rxjs';
import { distinctUntilChanged, tap } from 'rxjs/operators';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { ThemeService } from '../../../service/theme.service';

@Component({
  selector: 'app-ref-alts',
  templateUrl: './alts.component.html',
  styleUrls: ['./alts.component.scss']
})
export class RefAltsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  page: Page<Ref> = {
    content: [],
    empty: true,
    first: true,
    last: true,
    number: 0,
    size: 0,
    totalElements: 0,
    totalPages: 1,
  };

  constructor(
    private theme: ThemeService,
    public admin: AdminService,
    public account: AccountService,
    private route: ActivatedRoute,
    private refs: RefService,
  ) {
    combineLatest(this.url$, this.origin$).pipe(
      takeUntil(this.destroy$),
      switchMap(([url, origin]) => refs.get(url, origin)),
    ).subscribe(ref => {
      if (!ref.alternateUrls) return;
      for (const url of ref.alternateUrls) {
        this.page.empty = false;
        this.page.content.push({ url });
        this.page.totalElements++;
        this.page.size++;
      }
    });
  }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get url$() {
    return this.route.params.pipe(
      map(params => params['ref']),
      distinctUntilChanged(),
      tap(url => this.refs.get(url).subscribe(ref => this.theme.setTitle('Alts: ' + (ref.title || ref.url)))),
    );
  }

  get origin$() {
    return this.route.queryParams.pipe(
      map((params) => params['origin']),
      distinctUntilChanged(),
    );
  }

}
