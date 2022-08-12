import { Component, OnDestroy, OnInit } from '@angular/core';
import { autorun, IReactionDisposer } from 'mobx';
import { ThemeService } from '../../../service/theme.service';
import { OriginStore } from '../../../store/origin';
import { Store } from '../../../store/store';

@Component({
  selector: 'app-admin-origin-page',
  templateUrl: './origin.component.html',
  styleUrls: ['./origin.component.scss'],
})
export class AdminOriginPage implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];
  private defaultPageSize = 20;

  constructor(
    private theme: ThemeService,
    public store: Store,
    public query: OriginStore,
  ) {
    theme.setTitle('Admin: Origins');
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
