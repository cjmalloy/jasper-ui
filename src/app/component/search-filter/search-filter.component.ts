import { Component, HostBinding, Input, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { autorun, IReactionDisposer, toJS } from 'mobx';
import { RefSort } from '../../model/ref';
import { Store } from '../../store/store';

@Component({
  selector: 'app-search-filter',
  templateUrl: './search-filter.component.html',
  styleUrls: ['./search-filter.component.scss']
})
export class SearchFilterComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'search-filter form-group';

  private disposers: IReactionDisposer[] = [];

  @Input()
  showFilter = true;
  @Input()
  showSort = true;

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
