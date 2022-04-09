import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as _ from 'lodash';
import { combineLatest, map, Observable } from 'rxjs';
import { distinctUntilChanged, mergeMap } from 'rxjs/operators';
import { Feed } from '../../../model/feed';
import { Page } from '../../../model/page';
import { FeedService } from '../../../service/api/feed.service';

@Component({
  selector: 'app-settings-feed-page',
  templateUrl: './feed.component.html',
  styleUrls: ['./feed.component.scss']
})
export class SettingsFeedPage implements OnInit {

  page$: Observable<Page<Feed>>;

  private defaultPageSize = 20;

  constructor(
    private route: ActivatedRoute,
    private feeds: FeedService,
  ) {
    this.page$ = combineLatest(
      this.pageNumber$, this.pageSize$,
    ).pipe(
      distinctUntilChanged(_.isEqual),
      mergeMap(([pageNumber, pageSize]) => {
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
