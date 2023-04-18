import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnDestroy, OnInit } from '@angular/core';
import { intersection, map, uniq } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { catchError, forkJoin, Observable, of } from 'rxjs';
import { Action, sortOrder } from '../../model/tag';
import { deleteNotice } from '../../plugin/delete';
import { ActionService } from '../../service/action.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { OriginService } from '../../service/api/origin.service';
import { PluginService } from '../../service/api/plugin.service';
import { RefService } from '../../service/api/ref.service';
import { ScrapeService } from '../../service/api/scrape.service';
import { TaggingService } from '../../service/api/tagging.service';
import { TemplateService } from '../../service/api/template.service';
import { UserService } from '../../service/api/user.service';
import { AuthzService } from '../../service/authz.service';
import { ExtStore } from '../../store/ext';
import { PluginStore } from '../../store/plugin';
import { QueryStore } from '../../store/query';
import { Store } from '../../store/store';
import { TemplateStore } from '../../store/template';
import { UserStore } from '../../store/user';
import { Type } from '../../store/view';
import { downloadPage } from '../../util/download';
import { TAGS_REGEX } from '../../util/format';
import { printError } from '../../util/http';
import { hasTag } from '../../util/tag';

@Component({
  selector: 'app-bulk',
  templateUrl: './bulk.component.html',
  styleUrls: ['./bulk.component.scss']
})
export class BulkComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'bulk actions';
  tagRegex = TAGS_REGEX.source;

  private disposers: IReactionDisposer[] = [];

  @Input()
  type: Type = 'ref';

  actions: Action[] = [];
  batchRunning = false;
  tagging = false;
  deleting = false;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    public auth: AuthzService,
    public store: Store,
    public query: QueryStore,
    public ext: ExtStore,
    public user: UserStore,
    public plugin: PluginStore,
    public template: TemplateStore,
    private refs: RefService,
    private exts: ExtService,
    private users: UserService,
    private plugins: PluginService,
    private templates: TemplateService,
    private acts: ActionService,
    private ts: TaggingService,
    private scraper: ScrapeService,
    private origins: OriginService,
  ) {
    this.disposers.push(autorun(() => {
      const commonTags = intersection(...map(this.query.page?.content, ref => ref.tags || []));
      this.actions = sortOrder(this.admin.getActions(commonTags).filter(a => !('tag' in a) || this.auth.canAddTag(a.tag)));
    }));
  }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  get urls() {
    if (!this.query.page?.content.length) return [];
    return uniq(this.query.page!.content.map(ref => ref.url));
  }

  batch(fn: (e: any) => Observable<any> | void) {
    if (this.batchRunning) return;
    this.batchRunning = true;
    forkJoin(this.queryStore.page!.content.map(e => (fn(e) || of(null)).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError.push(...printError(err));
        return of(null);
      }),
    ))).subscribe(() => {
      this.queryStore.refresh();
      this.batchRunning = false;
    });
  }

  get queryStore() {
    switch (this.type) {
      case 'ref': return this.query;
      case 'ext': return this.ext
      case 'user': return this.user;
      case 'plugin': return this.plugin;
      case 'template': return this.template;
    }
  }

  get service() {
    switch (this.type) {
      case 'ref': return this.refs;
      case 'ext': return this.exts
      case 'user': return this.users
      case 'plugin': return this.plugins;
      case 'template': return this.templates;
    }
  }

  get empty() {
    return !this.queryStore.page?.content?.length;
  }

  get name() {
    let name = '';
    name = this.store.view.name || this.type;
    if (this.store.view.search) {
      name += ' search(' + this.store.view.search + ')';
    }
    if (this.store.view.filter.length) {
      name += ' filter(' + this.store.view.filter.join(',') + ')';
    }
    if (this.store.view.isSorted) {
      name += ' sort(' + this.store.view.sort.join(',') + ')';
    }
    return name;
  }

  download() {
    downloadPage(this.type, this.queryStore.page!, this.name);
  }

  tag(tag: string) {
    this.tagging = false;
    tag = tag.toLowerCase().trim();
    this.batch(ref => this.ts.create(tag, ref.url, ref.origin!));
  }

  approve() {
    this.batch(ref => {
      if (!hasTag('_moderated', ref)) {
        return this.refs.patch(ref.url, ref.origin!, [{
          op: 'add',
          path: '/tags/-',
          value: '_moderated',
        }]);
      } else {
        return of(null);
      }
    });
  }

  doAction(a: Action) {
    this.batch(ref => this.acts.apply(ref, a));
  }

  label(a: Action) {
    if ('tag' in a || 'response' in a) {
      if (a.labelOff && a.labelOn) return a.labelOff + ' / ' + a.labelOn;
      return a.labelOff || a.labelOn;
    }
    return a.label;
  }

  delete() {
    this.deleting = false;
    if (this.type === 'ref') {
      this.batch(ref => this.admin.status.plugins.delete
        ? this.refs.update(deleteNotice(ref))
        : this.refs.delete(ref.url, ref.origin)
      );
    } else {
      this.batch(tag => this.service.delete(tag.tag + tag.origin))
    }
  }
}
