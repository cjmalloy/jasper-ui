import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as _ from 'lodash';
import { combineLatest, map, Observable, switchMap } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { Origin } from '../../../model/origin';
import { Page } from '../../../model/page';
import { OriginService } from '../../../service/api/origin.service';
import { ThemeService } from '../../../service/theme.service';

@Component({
  selector: 'app-admin-origin-page',
  templateUrl: './origin.component.html',
  styleUrls: ['./origin.component.scss'],
})
export class AdminOriginPage implements OnInit {

  page$: Observable<Page<Origin>>;

  private defaultPageSize = 20;

  constructor(
    private theme: ThemeService,
    private route: ActivatedRoute,
    private origins: OriginService,
  ) {
    theme.setTitle('Admin: Origins');
    this.page$ = combineLatest(
      this.pageNumber$, this.pageSize$,
    ).pipe(
      distinctUntilChanged(_.isEqual),
      switchMap(([pageNumber, pageSize]) => {
        return this.origins.page({
          page: pageNumber,
          size: pageSize ?? this.defaultPageSize,
        });
      }));
  }

  ngOnInit(): void {
  }

  get pageNumber$() {
    return this.route.queryParams.pipe(
      map(params => params['pageNumber']),
    );
  }

  get pageSize$() {
    return this.route.queryParams.pipe(
      map(params => params['pageSize']),
    );
  }
}
