import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as _ from 'lodash';
import { combineLatest, map, Observable, switchMap } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { Feed } from '../../../model/feed';
import { Page } from '../../../model/page';
import { FeedService } from '../../../service/api/feed.service';
import { ThemeService } from '../../../service/theme.service';

@Component({
  selector: 'app-settings-feed-page',
  templateUrl: './feed.component.html',
  styleUrls: ['./feed.component.scss'],
})
export class SettingsFeedPage implements OnInit {

  page$: Observable<Page<Feed>>;

  private defaultPageSize = 20;

  constructor(
    private theme: ThemeService,
    private route: ActivatedRoute,
    private feeds: FeedService,
  ) {
    theme.setTitle('Settings: Feeds');
    this.page$ = combineLatest(
      this.pageNumber$, this.pageSize$,
    ).pipe(
      distinctUntilChanged(_.isEqual),
      switchMap(([pageNumber, pageSize]) => {
        return this.feeds.page({
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
