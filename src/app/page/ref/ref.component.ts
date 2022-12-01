import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { catchError, of } from 'rxjs';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { Store } from '../../store/store';
import { printError } from '../../util/http';

@Component({
  selector: 'app-ref-page',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss'],
})
export class RefPage implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];
  error?: HttpErrorResponse;
  printError = printError;

  constructor(
    public admin: AdminService,
    public store: Store,
    private refs: RefService,
  ) {
    store.view.clear();
  }

  get refWarning() {
    return (this.store.view.ref?.sources?.length || 0) > 0 && this.store.view.published && !this.store.view.ref!.published!.isSame(this.store.view.published);
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      const url = this.store.view.url;
      const origin = this.store.view.origin || this.store.account.origin;
      if (!url) return;
      this.refs.get(url, origin).pipe(
        catchError(err => {
          this.error = err;
          return of(undefined);
        }),
      ).subscribe(ref => runInAction(() => this.store.view.ref = ref));
      this.refs.count({ url }).pipe(
        catchError(err => {
          this.error = err;
          return of(0);
        }),
      ).subscribe(count => runInAction(() => this.store.view.remoteCount = count));
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

}
