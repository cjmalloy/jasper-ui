import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnDestroy, OnInit } from '@angular/core';
import { intersection, map, merge, uniq } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { catchError, concat, last, Observable, of, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Action, sortOrder } from '../../model/tag';
import { configDeleteNotice, deleteNotice, tagDeleteNotice } from '../../mods/delete';
import { ActionService } from '../../service/action.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
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
import { Ext } from '../../model/ext';

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
  @Input()
  activeExts: Ext[] = [];

  actions: Action[] = [];
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
    private scraper: ScrapeService,
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

  get defaultThumbnail() {
    return this.activeExts.find(x => x.config?.defaultThumbnail)?.config?.defaultThumbnail || '';
  }

  get urls() {
    if (!this.query.page?.content.length) return [];
    return uniq(this.query.page!.content.map(ref => ref.url));
  }

  batch$(fn: (e: any) => Observable<any> | void) {
    if (this.batchRunning) return of(null);
    this.serverError = [];
    this.batchRunning = true;
    return concat(...this.queryStore.page!.content.map(c => (fn(c) || of(null)).pipe(
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
    downloadPage(this.type, this.queryStore.page!, this.type !== 'ext' ? this.store.view.activeExts.filter(x => x.modifiedString) : [], this.name);
  }

  thumbnail$ = (url: string) => {
    return this.batch$(ref => {
      if (ref.plugins?.['plugin/thumbnail']?.url === url) return of(null);
      return this.refs.merge(ref.url, ref.origin!, ref.modifiedString, {
        tags: uniq([...(ref.tags || []), 'plugin/thumbnail']),
        plugins: {
          'plugin/thumbnail': {url}
        }
      })
    });
  }

  tag$ = (tag: string) => {
    return this.batch$(ref => this.ts.create(tag, ref.url, ref.origin!));
  }

  approve() {
    this.batch(ref => {
      if (!hasTag('_moderated', ref)) {
        return this.refs.patch(ref.url, ref.origin!, ref.modifiedString, [{
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
    this.batch(ref => this.acts.apply(a, ref));
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
      return this.batch$(ref => ref.origin === this.store.account.origin && this.admin.getPlugin('plugin/delete')
        ? this.refs.update(deleteNotice(ref))
        : this.refs.delete(ref.url, ref.origin)
      );
    } else if (this.type === 'ext' || this.type === 'user') {
      return this.batch$(tag => tag.origin === this.store.account.origin && this.admin.getPlugin('plugin/delete')
        ? this.tagService.update(tagDeleteNotice(tag))
        : this.tagService.delete(tag.tag + tag.origin))
    } else {
      return this.batch$(tag => tag.origin === this.store.account.origin && this.admin.getPlugin('plugin/delete')
        ? this.tagService.update(configDeleteNotice(tag))
        : this.tagService.delete(tag.tag + tag.origin))
    }
  }

  scrape$ = () => {
    return this.batch$(ref => {
      if (hasTag('+plugin/feed', ref)) {
        return this.scraper.feed(ref.url, ref.origin());
      } else {
        return this.scraper.webScrape(ref.url).pipe(switchMap(scraped => {
          if (ref.title && scraped.title?.includes(ref.title)) {
            // Avoid cluttering title
            scraped.title = ref.title;
          }
          scraped.origin = ref.origin;
          scraped.modifiedString = ref.modifiedString;
          scraped.sources = uniq([...ref.sources || [], ...scraped.sources || []]);
          scraped.alternateUrls = uniq([...ref.alternateUrls || [], ...scraped.alternateUrls || []]);
          scraped.tags = uniq([...ref.tags || [], ...scraped.tags || []]);
          scraped.plugins = merge(ref.plugins, scraped.plugins);
          return this.refs.update(scraped);
        }));
      }
    });
  }
}
