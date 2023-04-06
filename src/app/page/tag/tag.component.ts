import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { defer, uniq } from 'lodash-es';
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
import { defaultLocal, defaultWild, hasPrefix, isWild, removeWildcard } from '../../util/tag';

@Component({
  selector: 'app-tag-page',
  templateUrl: './tag.component.html',
  styleUrls: ['./tag.component.scss'],
})
export class TagPage implements OnInit, OnDestroy {
  private disposers: IReactionDisposer[] = [];

  templates = this.admin.tmplView;

  constructor(
    public admin: AdminService,
    public account: AccountService,
    public store: Store,
    public query: QueryStore,
    private theme: ThemeService,
    private router: Router,
    private refs: RefService,
    private exts: ExtService,
  ) { }

  ngOnInit(): void {
    this.store.view.clear(
      !!this.admin.status.plugins.voteUp ? 'voteScoreDecay'
        : this.store.view.tag.includes('*') ? 'published'
        : 'created');
    this.disposers.push(autorun(() => {
      this.theme.setTitle(this.store.view.name);
      if (!this.fetchPage && !this.store.view.list) return;
      var hideInternal = isWild(this.store.view.tag);
      const args = getArgs(
        this.store.view.query ? this.store.view.tag : defaultWild(this.store.view.tag),
        this.store.view.sort,
        hideInternal ? uniq(['query/!internal@*', ...this.store.view.filter]) as UrlFilter[] : this.store.view.filter,
        this.store.view.search,
        this.store.view.pageNumber,
        this.store.view.pageSize,
      );
      defer(() => this.query.setArgs(args));
    }));
    this.disposers.push(autorun(() => {
      const tag = defaultLocal(removeWildcard(this.store.view.tag, this.store.account.origin), this.store.account.origin);
      if (!tag || this.store.view.query) {
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
        .map(pin => this.refs.get(pin, this.store.account.origin).pipe(
          catchError(err => of({url: pin}))
        )))
        .subscribe(pinned => runInAction(() => this.store.view.pinned = pinned));
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  get isTemplate() {
    return !this.store.view.query && this.templates.find(t => hasPrefix(this.store.view.tag, t.tag));
  }

  get fetchPage() {
    if (this.store.view.graph) return true;
    if (this.store.view.isTemplate('blog')) return true;
    if (this.store.view.isTemplate('folder')) return true;
    return !this.isTemplate;
  }

}
