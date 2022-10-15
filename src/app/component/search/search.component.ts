import { Component, HostBinding, Input, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { autorun, IReactionDisposer, toJS } from 'mobx';
import { Store } from '../../store/store';

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'search form-group';

  private disposers: IReactionDisposer[] = [];

  searchValue = '';

  constructor(
    public router: Router,
    public store: Store,
  ) {
    this.disposers.push(autorun(() => {
      this.searchValue = toJS(this.store.view.search);
    }));
  }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  search() {
    this.router.navigate([], { queryParams: { search: this.searchValue }, queryParamsHandling: 'merge' });
  }

}
