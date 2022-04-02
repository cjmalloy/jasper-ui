import { Component, OnInit } from "@angular/core";
import { Ref } from "../../model/ref";
import { RefService } from "../../service/ref.service";
import { Page } from "../../model/page";
import { mergeMap, tap } from "rxjs/operators";
import { ActivatedRoute } from "@angular/router";
import { AccountService } from "../../service/account.service";
import { Observable, of } from "rxjs";

@Component({
  selector: 'app-home-page',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomePage implements OnInit {

  page?: Page<Ref>;
  path = 'all';
  filter = 'new';
  pageNumber?: number;
  pageSize = 20;

  constructor(
    private route: ActivatedRoute,
    private account: AccountService,
    private refs: RefService,
  ) {
    route.url.pipe(
      tap(segments => this.path = account.signedIn() ? segments[0].path : 'all'),
      mergeMap(() => route.params),
      tap(params => this.filter = params['filter']),
      mergeMap(() => route.queryParams),
      tap(queryParams => {
        this.pageNumber = queryParams['pageNumber'] ?? this.pageNumber;
        this.pageSize = queryParams['pageSize'] ?? this.pageSize;
      }),
    ).subscribe(() => this.refresh())
  }

  ngOnInit(): void {
  }

  get query(): Observable<Record<string, any>> {
    if (this.path === 'home') {
      if (this.filter === 'new') {
        return this.account.getMyUserExt().pipe(
          mergeMap(ext => of({ query: ext.config.subscriptions.join('+') }))
        );
      }
      if (this.filter === 'uncited') {
        return of({ uncited: true })
      }
      if (this.filter === 'unsourced') {
        return of({ unsourced: true })
      }
      throw `Invalid filter ${this.filter}`;
    }
    if (this.path === 'all') {
      return of({ query: '!plugin/comment@*' });
    }
    throw `Invalid path ${this.path}`;
  }

  refresh() {
    this.query.pipe(
      mergeMap(query => this.refs.page({
        ...query,
        page: this.pageNumber,
        size: this.pageSize,
      }))
    ).subscribe(page => this.page = page);
  }

}
