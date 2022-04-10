import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as _ from 'lodash';
import { combineLatest, map, Observable } from 'rxjs';
import { distinctUntilChanged, mergeMap } from 'rxjs/operators';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';
import { RefService } from '../../../service/api/ref.service';

@Component({
  selector: 'app-responses',
  templateUrl: './responses.component.html',
  styleUrls: ['./responses.component.scss'],
})
export class ResponsesComponent implements OnInit {

  page$: Observable<Page<Ref>>;

  private defaultPageSize = 20;

  constructor(
    private route: ActivatedRoute,
    private refs: RefService,
  ) {
    this.page$ = combineLatest(
      this.url$, this.search$, this.pageNumber$, this.pageSize$,
    ).pipe(
      distinctUntilChanged(_.isEqual),
      mergeMap(([url, search, pageNumber, pageSize]) => {
        return this.refs.page({
          query: '!internal@*',
          search,
          responses: url,
          page: pageNumber,
          size: pageSize ?? this.defaultPageSize,
        });
      }));
  }

  ngOnInit(): void {
  }

  get url$() {
    return this.route.params.pipe(
      map(params => params['ref']),
    );
  }

  get search$() {
    return this.route.queryParams.pipe(
      map(queryParams => queryParams['search'])
    );
  }

  get pageNumber$() {
    return this.route.queryParams.pipe(
      map(queryParams => queryParams['pageNumber'])
    );
  }

  get pageSize$() {
    return this.route.queryParams.pipe(
      map(queryParams => queryParams['pageSize'])
    );
  }

}
