import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as _ from 'lodash';
import { combineLatest, map, Observable } from 'rxjs';
import { distinctUntilChanged, mergeMap } from 'rxjs/operators';
import { Ext } from '../../../model/ext';
import { Page } from '../../../model/page';
import { ExtService } from '../../../service/api/ext.service';
import { ThemeService } from '../../../service/theme.service';

@Component({
  selector: 'app-settings-ext-page',
  templateUrl: './ext.component.html',
  styleUrls: ['./ext.component.scss'],
})
export class SettingsExtPage implements OnInit {

  page$: Observable<Page<Ext>>;

  private defaultPageSize = 20;

  constructor(
    private theme: ThemeService,
    private route: ActivatedRoute,
    private exts: ExtService,
  ) {
    theme.setTitle('Settings: Tag Extensions');
    this.page$ = combineLatest(
      this.pageNumber$, this.pageSize$,
    ).pipe(
      distinctUntilChanged(_.isEqual),
      mergeMap(([pageNumber, pageSize]) => {
        return this.exts.page({
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
