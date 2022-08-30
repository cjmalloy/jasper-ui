import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import * as _ from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { catchError, forkJoin, of } from 'rxjs';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { RefService } from '../../service/api/ref.service';
import { ThemeService } from '../../service/theme.service';
import { QueryStore } from '../../store/query';
import { Store } from '../../store/store';
import { filterListToObj, getArgs } from '../../util/query';
import { removeOriginWildcard } from '../../util/tag';

@Component({
  selector: 'app-tag-page',
  templateUrl: './tag.component.html',
  styleUrls: ['./tag.component.scss'],
})
export class TagPage implements OnInit, OnDestroy {

  query = new QueryStore(this.refs);

  private disposers: IReactionDisposer[] = [];

  constructor(
    public admin: AdminService,
    public account: AccountService,
    private theme: ThemeService,
    private router: Router,
    public store: Store,
    private refs: RefService,
    private exts: ExtService,
  ) {
    store.view.clear();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      this.theme.setTitle(this.store.view.name);
      if (!this.fetchPage) return;
      const args = getArgs(
        this.store.view.tag,
        this.store.view.sort,
        {...filterListToObj(this.store.view.filter), notInternal: this.wildcard},
        this.store.view.search,
        this.store.view.pageNumber,
        this.store.view.pageSize,
      );
      _.defer(() => this.query.setArgs(args));
    }));
    this.disposers.push(autorun(() => {
      const tag = removeOriginWildcard(this.store.view.tag);
      if (!tag) {
        runInAction(() => this.store.view.ext = undefined);
      } else {
        this.exts.get(tag).pipe(
          catchError(() => of(undefined)),
        ).subscribe(ext => runInAction(() => this.store.view.ext = ext));
      }
    }));
    this.disposers.push(autorun(() => {
      if (!this.store.view.ext?.config?.pinned?.length) {
        runInAction(() => this.store.view.pinned = undefined);
        return;
      }
      forkJoin((this.store.view.ext.config.pinned as string[])
        .map(pin => this.refs.get(pin)))
        .subscribe(pinned => runInAction(() => this.store.view.pinned = pinned));
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  get wildcard() {
    return this.store.view.tag === '@*' ||
      this.store.view.tag === '*';
  }

  get isList() {
    if (this.store.view.list) return true;
    if (this.store.view.graph) return true;
    if (this.store.view.kanban) return false;
    if (this.store.view.blog) return false;
    return true;
  }

  get showListButton() {
    if (this.store.view.kanban) return true;
    if (this.store.view.blog) return true;
    return false;
  }

  get fetchPage() {
    if (this.isList) return true;
    if (this.store.view.blog) return true;
    return false;
  }

}
