import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as _ from 'lodash';
import { combineLatest, map, Observable } from 'rxjs';
import { distinctUntilChanged, mergeMap } from 'rxjs/operators';
import { Page } from '../../../model/page';
import { Plugin } from '../../../model/plugin';
import { PluginService } from '../../../service/api/plugin.service';

@Component({
  selector: 'app-admin-plugin-page',
  templateUrl: './plugin.component.html',
  styleUrls: ['./plugin.component.scss']
})
export class AdminPluginPage implements OnInit {

  page$: Observable<Page<Plugin>>;

  private defaultPageSize = 20;

  constructor(
    private route: ActivatedRoute,
    private plugins: PluginService,
  ) {
    this.page$ = combineLatest(
      this.pageNumber$, this.pageSize$,
    ).pipe(
      distinctUntilChanged(_.isEqual),
      mergeMap(([pageNumber, pageSize]) => {
        return this.plugins.page({
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
