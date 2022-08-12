import { Component, OnDestroy, OnInit } from '@angular/core';
import { autorun, IReactionDisposer } from 'mobx';
import { ThemeService } from '../../../service/theme.service';
import { FeedStore } from '../../../store/feed';
import { Store } from '../../../store/store';

@Component({
  selector: 'app-settings-feed-page',
  templateUrl: './feed.component.html',
  styleUrls: ['./feed.component.scss'],
})
export class SettingsFeedPage implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];
  private defaultPageSize = 20;

  constructor(
    private theme: ThemeService,
    public store: Store,
    public query: FeedStore,
  ) {
    theme.setTitle('Settings: Feeds');
    query.clear();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      this.query.setArgs({
        page: this.store.view.pageNumber,
        size: this.store.view.pageSize ?? this.defaultPageSize,
      });
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }
}
