import { KeyValuePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { RouterLink } from '@angular/router';
import { groupBy, intersection, isEqual, map, pick, uniq } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { catchError, concat, last, Observable, of, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { TitleDirective } from '../../directive/title.directive';
import { patchPlugins } from '../../form/plugins/plugins.component';
import { Ext } from '../../model/ext';
import { Plugin } from '../../model/plugin';
import { Ref } from '../../model/ref';
import { Action, active, sortOrder, Tag, uniqueConfigs, visible } from '../../model/tag';
import { Template } from '../../model/template';
import { User } from '../../model/user';
import { deleteNotice, isDeletorTag, tagDeleteNotice } from '../../mods/delete';
import { ActionService } from '../../service/action.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { PluginService } from '../../service/api/plugin.service';
import { RefService } from '../../service/api/ref.service';
import { TaggingService } from '../../service/api/tagging.service';
import { TemplateService } from '../../service/api/template.service';
import { UserService } from '../../service/api/user.service';
import { AuthzService } from '../../service/authz.service';
import { HelpService } from '../../service/help.service';
import { ExtStore } from '../../store/ext';
import { PluginStore } from '../../store/plugin';
import { QueryStore } from '../../store/query';
import { Store } from '../../store/store';
import { TemplateStore } from '../../store/template';
import { UserStore } from '../../store/user';
import { Type } from '../../store/view';
import { downloadPage } from '../../util/download';
import { getScheme, printError } from '../../util/http';
import { memo, MemoCache } from '../../util/memo';
import { addAllHierarchicalTags, expandedTagsInclude, hasTag, isAuthorTag, subOrigin } from '../../util/tag';
import { ConfirmActionComponent } from '../action/confirm-action/confirm-action.component';
import { InlineButtonComponent } from '../action/inline-button/inline-button.component';
import { InlinePluginComponent } from '../action/inline-plugin/inline-plugin.component';
import { InlineTagComponent } from '../action/inline-tag/inline-tag.component';
import { LoadingComponent } from '../loading/loading.component';

@Component({
  selector: 'app-bulk',
  templateUrl: './bulk.component.html',
  styleUrls: ['./bulk.component.scss'],
  host: { 'class': 'bulk actions' },
  imports: [LoadingComponent, RouterLink, InlineTagComponent, ConfirmActionComponent, InlinePluginComponent, TitleDirective, InlineButtonComponent, KeyValuePipe]
})
export class BulkComponent implements AfterViewInit, OnChanges, OnDestroy {

  private disposers: IReactionDisposer[] = [];

  @Input()
  type: Type = 'ref';
  @Input()
  viewExt?: Ext;
  @Input()
  activeExts: Ext[] = [];

  defaults?: Partial<Ref>;
  forms: Plugin[] = [];
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
    private el: ElementRef,
    private help: HelpService,
  ) {
    this.disposers.push(autorun(() => {
      MemoCache.clear(this);
      const commonTags = intersection(...map(this.query.page?.content, ref => ref.tags || []));
      this.forms = this.admin.bulkForm;
      this.actions = uniqueConfigs([
        ...sortOrder(this.admin.getActions(commonTags).filter(a => !('tag' in a) || this.auth.canAddTag(a.tag))),
        ...sortOrder(this.admin.getAdvancedActions(commonTags))]);
      this.groupedActions = groupBy(this.actions, a => this.label(a));
      delete this.defaults;
      const xs = [...(this.viewExt ? [this.viewExt] : []), ...this.activeExts, this.admin.getTemplate('')] as Tag[];
      this.refs.getDefaults(...xs.filter(x => x).map(x => x.tag)).subscribe(d => this.defaults = d?.ref)
    }));
  }

  ngAfterViewInit() {
    this.help.pushStep(this.el?.nativeElement, $localize`Bulk actions will only affect all Refs in the current page.`);
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

  plugin$ = (value: any) => {
    return this.batch$<Ref>(ref => {
      if (isEqual(ref.plugins, value)) return of(null);
      return this.refs.merge(ref.url, ref.origin!, ref.modifiedString!, {
        tags: uniq([...(ref.tags || []), ...Object.keys(value)]),
        plugins: patchPlugins(value),
      });
    });
  }

  tag$ = (tag: string) => {
    return this.batch$<Ref>(ref => this.ts.create(tag, ref.url, ref.origin!));
  }

  doAction$ = (as: Action[]) => () => {
    return this.batch$<Ref>(ref => this.acts.apply$(as.filter(a => this.showAction(ref, a)), ref));
  }

  showAction(ref: Ref, a: Action) {
    if (!visible(ref, a, isAuthorTag(this.store.account.tag, ref), hasTag(this.store.account.mailbox, ref))) return false;
    const writeAccess = this.auth.writeAccess(ref);
    const taggingAccess = this.auth.taggingAccess(ref);
    if ('scheme' in a) {
      if (a.scheme !== getScheme(ref.url)) return false;
    }
    if ('tag' in a) {
      if (a.tag === 'locked' && !writeAccess) return false;
      if (a.tag && !taggingAccess) return false;
      if (a.tag && !this.auth.canAddTag(a.tag)) return false;
    }
    if ('tag' in a || 'response' in a) {
      if (active(ref, a) && !a.labelOn) return false;
      if (!active(ref, a) && !a.labelOff) return false;
    } else {
      if (!a.label) return false;
    }
    return true;
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
        switchMap(() => !isDeletorTag(tag.tag) && this.admin.getPlugin('plugin/delete')
          ? this.tagService.create(tagDeleteNotice(tag))
          : of(null)),
      ));
    } else {
      return this.batch$<Plugin | Template>(tag => this.tagService.delete(tag.tag + tag.origin).pipe(
        switchMap(() => !isDeletorTag(tag.tag) && this.admin.getPlugin('plugin/delete')
          ? this.tagService.create(tagDeleteNotice(tag))
          : of(null)),
      ));
    }
  }

  forceDelete$ = () => {
    if (this.type === 'ref') {
      return this.batch$<Ref>(ref => this.refs.delete(ref.url, ref.origin));
    } else {
      return this.delete$();
    }
  }

  copy$ = () => {
    return this.batch$<Ref>(ref => {
      if (ref.origin === this.store.account.origin) return of(null);
      const tags = uniq(addAllHierarchicalTags([
        ...(this.store.account.localTag ? [this.store.account.localTag] : []),
        ...(ref.tags || []).filter(t => this.auth.canAddTag(t))
      ]).filter(t => !expandedTagsInclude(t, '+plugin/origin/push')
        && !expandedTagsInclude(t, 'plugin/delta')
        && !expandedTagsInclude(t, '+plugin/delta')
        && !expandedTagsInclude(t, '+plugin/cron')));
      const copied: Ref = {
        ...ref,
        origin: this.store.account.origin,
        tags,
      };
      copied.plugins = pick(copied.plugins, tags || []);
      if (hasTag('+plugin/origin', copied)) {
        copied.plugins['+plugin/origin'].local = copied.plugins['+plugin/origin'].remote = subOrigin(ref.origin, copied.plugins['+plugin/origin'].local);
        copied.plugins['+plugin/origin'].proxy = this.store.origins.lookup.get(ref.origin || '');
      }
      if (hasTag('+plugin/origin/tunnel', copied)) {
        copied.plugins['+plugin/origin/tunnel'] = this.store.origins.tunnelLookup.get(ref.origin || '');
      }
      copied.plugins = pick(copied.plugins, tags || []);
      return this.refs.create(copied);
    });
  }
}
