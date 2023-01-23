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
import { getArgs, UrlFilter } from '../../util/query';
import { removeWildcard } from '../../util/tag';

@Component({
  selector: 'app-tag-page',
  templateUrl: './tag.component.html',
  styleUrls: ['./tag.component.scss'],
})
export class TagPage implements OnInit, OnDestroy {
  private disposers: IReactionDisposer[] = [];

  constructor(
    public admin: AdminService,
    public account: AccountService,
    public store: Store,
    public query: QueryStore,
    private theme: ThemeService,
    private router: Router,
    private refs: RefService,
    private exts: ExtService,
  ) {
    store.view.clear('created');
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      this.theme.setTitle(this.store.view.name);
      if (!this.fetchPage && !this.store.view.list) return;
      const args = getArgs(
        this.store.view.tag,
        this.store.view.sort,
        _.uniq(['notInternal', ...this.store.view.filter]) as UrlFilter[],
        this.store.view.search,
        this.store.view.pageNumber,
        this.store.view.pageSize,
      );
      if (this.admin.status.plugins.comment) {
        args.query += '|plugin/comment@*'
      }
      _.defer(() => this.query.setArgs(args));
    }));
    this.disposers.push(autorun(() => {
      const tag = removeWildcard(this.store.view.tag);
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
        .map(pin => this.refs.get(pin).pipe(
          catchError(err => of({url: pin}))
        )))
        .subscribe(pinned => runInAction(() => this.store.view.pinned = pinned));
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  get isSpecial() {
    if (this.store.view.kanban) return true;
    if (this.store.view.chat) return true;
    if (this.store.view.blog) return true;
    return false;
  }

  get isList() {
    if (this.store.view.list) return true;
    if (this.store.view.graph) return true;
    if (this.store.view.kanban) return false;
    if (this.store.view.chat) return false;
    if (this.store.view.blog) return false;
    return true;
  }

  get fetchPage() {
    if (this.store.view.graph) return true;
    if (this.store.view.blog) return true;
    return !this.isSpecial;
  }

}
