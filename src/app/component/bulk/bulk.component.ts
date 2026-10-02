import { KeyValuePipe } from '@angular/common';
import { FakeLinkDirective } from '../../directive/fake-link.directive';
import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, input, signal,
  computed
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { groupBy, intersection, isEqual, pick, uniq } from 'lodash-es';
import { catchError, concat, last, Observable, of, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { TitleDirective } from '../../directive/title.directive';
import { patchPlugins } from '../../form/plugins/plugins.component';
import { Ext } from '../../model/ext';
import { Plugin } from '../../model/plugin';
import { Ref } from '../../model/ref';
import { Action, active, sortOrder, uniqueConfigs, visible } from '../../model/tag';
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
import { expandedTagsInclude, hasTag, isAuthorTag, subOrigin } from '../../util/tag';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FakeLinkDirective, LoadingComponent, RouterLink, InlineTagComponent, ConfirmActionComponent, InlinePluginComponent, TitleDirective, InlineButtonComponent, KeyValuePipe]
})
export class BulkComponent implements AfterViewInit {

  readonly type = input<Type>('ref');
  readonly viewExt = input<Ext>();
  readonly activeExts = input<Ext[]>([]);

  private readonly defaultsResource = rxResource({
    params: () => [...(this.viewExt() ? [this.viewExt()!] : []), ...this.activeExts(), this.admin.getTemplate('')]
      .filter(tag => !!tag).map(tag => tag.tag),
    stream: ({ params }) => this.refs.getDefaults(...params),
  });
  readonly defaults = computed(() => this.defaultsResource.hasValue() ? this.defaultsResource.value()?.ref : undefined);
  readonly defaultsError = computed(() => {
    const error = this.defaultsResource.error();
    if (!error) return [];
    return error instanceof HttpErrorResponse ? printError(error) : [String(error)];
  });
  readonly forms = computed(() => this.admin.bulkForm());
  readonly actions = computed(() => {
    const content = this.queryStore().page()?.content ?? [];
    const commonTags = intersection(...content.map(ref => 'tags' in ref ? ref.tags || [] : []));
    return uniqueConfigs([
      ...sortOrder(this.admin.getActions(commonTags).filter(a => !('tag' in a) || this.auth.canAddTag(a.tag))),
      ...sortOrder(this.admin.getAdvancedActions(commonTags)),
    ]);
  });
  readonly groupedActions = computed(() => groupBy(this.actions(), a => this.label(a)));
  readonly batchRunning = signal(false);
  readonly serverError = signal<string[]>([]);

  toggled = false;

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
  }

  ngAfterViewInit() {
    this.help.pushStep(this.el?.nativeElement, $localize`Bulk actions will only affect all Refs in the current page.`);
  }

  readonly urls = computed(() => {
    if (!this.query.page()?.content.length) return [];
    return uniq(this.query.page()!.content.map(ref => ref.url));
  });

  batch$<T>(fn: (e: T) => Observable<any> | void) {
    if (this.batchRunning()) return of(null);
    this.serverError.set([]);
    this.batchRunning.set(true);
    return concat(...this.queryStore().page()!.content.map(c => (fn(c as T) || of(null)).pipe(
      catchError(err => {
        if (err instanceof HttpErrorResponse) {
          this.serverError.update(errors => [...errors, ...printError(err)]);
        } else {
          this.serverError.update(errors => [...errors, err+'']);
        }
        return of(null);
      }),
    ))).pipe(
      last(),
      tap(() => {
        this.queryStore().refresh();
        this.batchRunning.set(false);
      })
    );
  }

  batch(fn: (e: any) => Observable<any> | void) {
    return this.batch$(fn).subscribe();
  }

  readonly queryStore = computed(() => {
    switch (this.type()) {
      case 'ref': return this.query;
      case 'ext': return this.ext
      case 'user': return this.user;
      case 'plugin': return this.plugin;
      case 'template': return this.template;
    }
  });

  readonly service = computed(() => {
    switch (this.type()) {
      case 'ref': return this.refs;
      case 'ext': return this.exts
      case 'user': return this.users
      case 'plugin': return this.plugins;
      case 'template': return this.templates;
    }
  });

  readonly tagService = computed(() => {
    switch (this.type()) {
      case 'ref': throw 'Not a tag';
      case 'ext': return this.exts
      case 'user': return this.users
      case 'plugin': return this.plugins;
      case 'template': return this.templates;
    }
  });

  readonly empty = computed(() => !this.queryStore().page()?.content?.length);

  readonly name = computed(() => {
    let name = '';
    name = this.store.view.name() || this.type();
    if (this.store.view.search()) {
      name += ' search(' + this.store.view.search() + ')';
    }
    if (this.store.view.filter().length) {
      name += ' filter(' + this.store.view.filter().join(',') + ')';
    }
    if (this.store.view.isSorted()) {
      name += ' sort(' + this.store.view.sort().join(',') + ')';
    }
    return name;
  });

  toggle() {
    this.toggled = !this.toggled;
    this.store.eventBus.fire(this.toggled ? 'toggle-all-open' : 'toggle-all-closed');
  }

  download() {
    downloadPage(this.type(), this.items(), this.type() !== 'ext' ? this.store.view.activeExts().filter(x => x.modifiedString) : [], this.name());
  }

  readonly items = computed(() => {
    const result = this.queryStore().page()!;
    const ref = this.store.view.ref();
    return this.type() === 'ref' && ref
      ? { ...result, content: [ref, ...result.content] } as typeof result
      : result;
  });

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
    if (!visible(ref, a, isAuthorTag(this.store.account.tag(), ref), hasTag(this.store.account.mailbox(), ref))) return false;
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
    const type = this.type();
    if (type === 'ref') {
      return this.batch$<Ref>(ref => ref.origin === this.store.account.origin() && !hasTag('plugin/delete', ref) && this.admin.getPlugin('plugin/delete')
        ? this.refs.update(deleteNotice(ref))
        : this.refs.delete(ref.url, ref.origin)
      );
    } else if (type === 'ext' || type === 'user') {
      return this.batch$<Ext | User>(tag => this.tagService().delete(tag.tag + tag.origin).pipe(
        switchMap(() => !isDeletorTag(tag.tag) && this.admin.getPlugin('plugin/delete')
          ? this.tagService().create(tagDeleteNotice(tag))
          : of(null)),
      ));
    } else {
      return this.batch$<Plugin | Template>(tag => this.tagService().delete(tag.tag + tag.origin).pipe(
        switchMap(() => !isDeletorTag(tag.tag) && this.admin.getPlugin('plugin/delete')
          ? this.tagService().create(tagDeleteNotice(tag))
          : of(null)),
      ));
    }
  }

  forceDelete$ = () => {
    if (this.type() === 'ref') {
      return this.batch$<Ref>(ref => this.refs.delete(ref.url, ref.origin));
    } else {
      return this.delete$();
    }
  }

  copy$ = () => {
    return this.batch$<Ref>(ref => {
      if (ref.origin === this.store.account.origin()) return of(null);
      const tags = uniq([
        ...(this.store.account.localTag() ? [this.store.account.localTag()] : []),
        ...(ref.tags || []).filter(t => this.auth.canAddTag(t))
      ].filter(t => !expandedTagsInclude(t, '+plugin/origin/push')
        && !expandedTagsInclude(t, 'plugin/delta')
        && !expandedTagsInclude(t, '+plugin/delta')
        && !expandedTagsInclude(t, '+plugin/cron')));
      const copied: Ref = {
        ...ref,
        origin: this.store.account.origin(),
        tags,
      };
      copied.plugins = pick(copied.plugins, tags || []);
      if (hasTag('+plugin/origin', copied)) {
        const origin = subOrigin(ref.origin, copied.plugins['+plugin/origin'].local);
        copied.plugins['+plugin/origin'] = {
          ...copied.plugins['+plugin/origin'],
          local: origin,
          remote: origin,
          proxy: this.store.origins.lookup().get(ref.origin || ''),
        };
      }
      if (hasTag('+plugin/origin/tunnel', copied)) {
        copied.plugins['+plugin/origin/tunnel'] = this.store.origins.tunnelLookup().get(ref.origin || '');
      }
      copied.plugins = pick(copied.plugins, tags || []);
      return this.refs.create(copied);
    });
  }
}
