import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { groupBy, intersection, map, pick, uniq } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { catchError, concat, last, Observable, of, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Ext } from '../../model/ext';
import { Plugin } from '../../model/plugin';
import { Ref } from '../../model/ref';
import { Action, sortOrder, uniqueConfigs } from '../../model/tag';
import { Template } from '../../model/template';
import { User } from '../../model/user';
import { deleteNotice, tagDeleteNotice } from '../../mods/delete';
import { ActionService } from '../../service/action.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { PluginService } from '../../service/api/plugin.service';
import { RefService } from '../../service/api/ref.service';
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
import { printError } from '../../util/http';
import { memo, MemoCache } from '../../util/memo';
import { hasTag } from '../../util/tag';

@Component({
  selector: 'app-bulk',
  templateUrl: './bulk.component.html',
  styleUrls: ['./bulk.component.scss']
})
export class BulkComponent implements OnChanges, OnDestroy {
  @HostBinding('class') css = 'bulk actions';

  private disposers: IReactionDisposer[] = [];

  @Input()
  type: Type = 'ref';
  @Input()
  viewExt?: Ext;
  @Input()
  activeExts: Ext[] = [];

  actions: Action[] = [];
  groupedActions: { [key: string]: Action[] } = {};
  batchRunning = false;
  toggled = false;
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
  ) {
    this.disposers.push(autorun(() => {
      MemoCache.clear(this);
      const commonTags = intersection(...map(this.query.page?.content, ref => ref.tags || []));
      this.actions = uniqueConfigs([
        ...sortOrder(this.admin.getActions(commonTags).filter(a => !('tag' in a) || this.auth.canAddTag(a.tag))),
        ...sortOrder(this.admin.getAdvancedActions(commonTags))]);
      this.groupedActions = groupBy(this.actions, a => this.label(a));
    }));
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.type || changes.activeExts) {
      MemoCache.clear(this);
    }
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  @memo
  get defaultThumbnail() {
    return [...(this.viewExt ? [this.viewExt] : []), ...this.activeExts, this.admin.getTemplate('')].find(x => x?.config?.defaultThumbnail)?.config?.defaultThumbnail || '';
  }

  @memo
  get urls() {
    if (!this.query.page?.content.length) return [];
    return uniq(this.query.page!.content.map(ref => ref.url));
  }

  batch$<T>(fn: (e: T) => Observable<any> | void) {
    if (this.batchRunning) return of(null);
    this.serverError = [];
    this.batchRunning = true;
    return concat(...this.queryStore.page!.content.map(c => (fn(c as T) || of(null)).pipe(
      catchError(err => {
        if (err instanceof HttpErrorResponse) {
          this.serverError.push(...printError(err));
        } else {
          this.serverError.push(err+'');
        }
        return of(null);
      }),
    ))).pipe(
      last(),
      tap(() => {
        this.queryStore.refresh();
        this.batchRunning = false;
      })
    );
  }

  batch(fn: (e: any) => Observable<any> | void) {
    return this.batch$(fn).subscribe();
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

  get tagService() {
    switch (this.type) {
      case 'ref': throw 'Not a tag';
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

  toggle() {
    this.toggled = !this.toggled;
    this.store.eventBus.fire(this.toggled ? 'toggle-all-open' : 'toggle-all-closed');
  }

  download() {
    downloadPage(this.type, this.items, this.type !== 'ext' ? this.store.view.activeExts.filter(x => x.modifiedString) : [], this.name);
  }

  get items() {
    let result = this.queryStore.page!;
    if (this.type === 'ref' && this.store.view.ref) {
      result = {...result};
      result.content = [...result.content] as any;
      result.content.unshift(this.store.view.ref as any);
    }
    return result;
  }

  thumbnail$ = (url: string) => {
    return this.batch$<Ref>(ref => {
      if (ref.plugins?.['plugin/thumbnail']?.url === url) return of(null);
      return this.refs.merge(ref.url, ref.origin!, ref.modifiedString!, {
        tags: uniq([...(ref.tags || []), 'plugin/thumbnail']),
        plugins: {
          'plugin/thumbnail': {url}
        }
      })
    });
  }

  tag$ = (tag: string) => {
    return this.batch$<Ref>(ref => this.ts.create(tag, ref.url, ref.origin!));
  }

  doAction$ = (a: Action[]) => () => {
    return this.batch$<Ref>(ref => this.acts.apply$(a, ref));
  }

  label(a: Action) {
    if ('tag' in a || 'response' in a) {
      if (a.labelOff && a.labelOn) return a.labelOff + ' / ' + a.labelOn;
      return a.labelOff || a.labelOn;
    }
    return a.label;
  }

  delete$ = () => {
    if (this.type === 'ref') {
      return this.batch$<Ref>(ref => ref.origin === this.store.account.origin && !hasTag('plugin/delete', ref) && this.admin.getPlugin('plugin/delete')
        ? this.refs.update(deleteNotice(ref))
        : this.refs.delete(ref.url, ref.origin)
      );
    } else if (this.type === 'ext' || this.type === 'user') {
      return this.batch$<Ext | User>(tag => this.tagService.delete(tag.tag + tag.origin).pipe(
        switchMap(() => !tag.tag.endsWith('/deleted') && this.admin.getPlugin('plugin/delete')
          ? this.tagService.create(tagDeleteNotice(tag))
          : of(null)),
      ));
    } else {
      return this.batch$<Plugin | Template>(tag => this.tagService.delete(tag.tag + tag.origin).pipe(
        switchMap(() => !tag.tag.endsWith('/deleted') && this.admin.getPlugin('plugin/delete')
          ? this.tagService.create(tagDeleteNotice(tag))
          : of(null)),
      ));
    }
  }

  copy$ = () => {
    return this.batch$<Ref>(ref => {
      if (ref.origin === this.store.account.origin) return of(null);
      const tags = uniq([
        ...(this.store.account.localTag ? [this.store.account.localTag] : []),
        ...(ref.tags || []).filter(t => this.auth.canAddTag(t))
      ]);
      const copied: Ref = {
        ...ref,
        origin: this.store.account.origin,
        tags,
      };
      copied.plugins = pick(copied.plugins, tags || []);
      return this.refs.create(copied, true);
    });
  }
}
