import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  HostBinding,
  Input,
  OnChanges,
  OnDestroy,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren
} from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { defer, intersection, uniq, without } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import * as moment from 'moment';
import { catchError, map, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { writePlugins } from '../../../form/plugins/plugins.component';
import { refForm, RefFormComponent } from '../../../form/ref/ref.component';
import { Ext } from '../../../model/ext';
import { Ref, writeRef } from '../../../model/ref';
import {
  Action,
  active,
  Icon,
  ResponseAction,
  sortOrder,
  TagAction,
  uniqueConfigs,
  Visibility,
  visible
} from '../../../model/tag';
import { findArchive } from '../../../mods/archive';
import { deleteNotice } from '../../../mods/delete';
import { ActionService } from '../../../service/action.service';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { RefService } from '../../../service/api/ref.service';
import { ScrapeService } from '../../../service/api/scrape.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { AuthzService } from '../../../service/authz.service';
import { BookmarkService } from '../../../service/bookmark.service';
import { ConfigService } from '../../../service/config.service';
import { EditorService } from '../../../service/editor.service';
import { Store } from '../../../store/store';
import { downloadRef } from '../../../util/download';
import { scrollToFirstInvalid } from '../../../util/form';
import { authors, clickableLink, formatAuthor, interestingTags } from '../../../util/format';
import { getScheme } from '../../../util/hosts';
import { printError } from '../../../util/http';
import { memo, MemoCache } from '../../../util/memo';
import { hasTag, isOwnerTag, localTag, tagOrigin } from '../../../util/tag';
import { ActionComponent } from '../../action/action.component';

@Component({
  selector: 'app-blog-entry',
  templateUrl: './blog-entry.component.html',
  styleUrls: ['./blog-entry.component.scss']
})
export class BlogEntryComponent implements OnChanges, OnDestroy {
  @HostBinding('class') css = 'blog-entry';
  @HostBinding('attr.tabindex') tabIndex = 0;
  private disposers: IReactionDisposer[] = [];

  @ViewChildren('action')
  actionComponents?: QueryList<ActionComponent>;

  @Input()
  blog?: Ext;
  @Input()
  ref!: Ref;

  editForm: UntypedFormGroup;
  submitted = false;
  icons: Icon[] = [];
  actions: Action[] = [];
  editorPlugins: string[] = [];
  editing = false;
  viewSource = false;
  @HostBinding('class.deleted')
  deleted = false;
  writeAccess = false;
  taggingAccess = false;
  serverError: string[] = [];

  constructor(
    private config: ConfigService,
    public admin: AdminService,
    public store: Store,
    private router: Router,
    private auth: AuthzService,
    private editor: EditorService,
    private refs: RefService,
    private exts: ExtService,
    public acts: ActionService,
    private bookmarks: BookmarkService,
    private scraper: ScrapeService,
    private ts: TaggingService,
    private fb: UntypedFormBuilder,
  ) {
    this.editForm = refForm(fb);
    this.disposers.push(autorun(() => {
      if (this.store.eventBus.event === 'refresh') {
        if (this.ref?.url && this.store.eventBus.isRef(this.ref)) {
          this.ref = this.store.eventBus.ref!;
          this.init();
        }
      }
      if (this.store.eventBus.event === 'error') {
        if (this.ref?.url && this.store.eventBus.isRef(this.ref)) {
          this.serverError = this.store.eventBus.errors;
        }
      }
    }));
  }

  init() {
    MemoCache.clear(this);
    this.submitted = false;
    this.deleted = false;
    this.editing = false;
    this.viewSource = false;
    this.actionComponents?.forEach(c => c.reset());
    this.writeAccess = this.auth.writeAccess(this.ref);
    this.taggingAccess = this.auth.taggingAccess(this.ref);
    this.icons = uniqueConfigs(sortOrder(this.admin.getIcons(this.ref.tags, this.ref.plugins, getScheme(this.ref.url))));
    this.actions = uniqueConfigs(sortOrder(this.admin.getActions(this.ref.tags, this.ref.plugins)));
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.ref) {
      this.init();
    }
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  @memo
  get nonLocalOrigin() {
    if (this.ref.origin === this.store.account.origin) return undefined;
    return this.ref.origin || '';
  }

  @memo
  get title() {
    const title = (this.ref.title || '').trim();
    const comment = (this.ref.comment || '').trim();
    if (title) return this.ref.title;
    if (!comment) return this.ref.url;
    if (comment.length <= 140) return comment;
    return comment.substring(0, 140);
  }

  @ViewChild(RefFormComponent)
  set refForm(value: RefFormComponent) {
    defer(() => {
      value?.setRef(this.ref);
      this.editor.syncEditor(this.fb, this.editForm, this.ref.comment);
    });
  }

  @memo
  get canInvoice() {
    if (!this.local) return false;
    if (!this.admin.getPlugin('plugin/invoice')) return false;
    if (!this.isAuthor) return false;
    if (!this.ref.sources || !this.ref.sources.length) return false;
    return hasTag('plugin/comment', this.ref) ||
      !hasTag('internal', this.ref);
  }

  @memo
  get local() {
    return this.ref.origin === this.store.account.origin;
  }

  @memo
  get localhost() {
    return this.ref.url.startsWith(this.config.base);
  }

  @memo
  get pdf() {
    if (!this.admin.getPlugin('plugin/pdf')) return null;
    return this.ref.plugins?.['plugin/pdf']?.url || this.findPdf;
  }

  @memo
  get findPdf() {
    if (!this.ref.alternateUrls) return null;
    for (const s of this.ref.alternateUrls) {
      if (new URL(s).pathname.endsWith('.pdf')) {
        return s;
      }
    }
    return null;
  }

  @memo
  get archive() {
    const plugin = this.admin.getPlugin('plugin/archive');
    if (!plugin) return null;
    return this.ref.plugins?.['plugin/archive']?.url || findArchive(plugin, this.ref);
  }

  @memo
  get isAuthor() {
    return isOwnerTag(this.store.account.tag, this.ref);
  }

  @memo
  get isRecipient() {
    return hasTag(this.store.account.mailbox, this.ref);
  }

  @memo
  get authors() {
    const lookup = this.store.origins.originMap.get(this.ref.origin || '');
    return uniq([
      ...this.ref.tags?.filter(t => t.startsWith('+plugin/') && this.admin.getPlugin(t)?.config?.signature) || [],
      ...authors(this.ref).map(a => !tagOrigin(a) ? a : localTag(a) + (lookup?.get(tagOrigin(a)) || '')),
    ]);
  }

  @memo
  get authorExts$() {
    return this.exts.getCachedExts(this.authors, this.ref.origin || '').pipe(this.admin.authorFallback);
  }

  @memo
  get tags() {
    let result = interestingTags(this.ref.tags);
    if (!this.blog?.config?.filterTags) return result;
    return intersection(result, this.blog.config.tags || []);
  }

  @memo
  get tagExts$() {
    return this.exts.getCachedExts(this.tags, this.ref.origin || '').pipe(this.admin.authorFallback);
  }

  @memo
  get clickableLink() {
    return clickableLink(this.ref.url);
  }

  @memo
  get comments() {
    if (!this.admin.getPlugin('plugin/comment')) return 0;
    return this.ref.metadata?.plugins?.['plugin/comment'] || 0;
  }

  @memo
  get responses() {
    return this.ref.metadata?.responses || 0;
  }

  @memo
  get sources() {
    return this.ref.sources?.length || 0;
  }

  @memo
  formatAuthor(user: string) {
    if (this.store.account.origin && tagOrigin(user) === this.store.account.origin) {
      user = user.replace(this.store.account.origin, '');
    }
    return formatAuthor(user);
  }

  download() {
    downloadRef(writeRef(this.ref));
  }

  tag$ = (tag: string) => {
    this.serverError = [];
    return this.store.eventBus.runAndReload$(this.ts.create(tag, this.ref.url, this.ref.origin!), this.ref);
  }

  visible(v: Visibility) {
    return visible(v, this.isAuthor, this.isRecipient);
  }

  label(a: Action) {
    if ('tag' in a || 'response' in a) {
      return active(this.ref, a) ? 'labelOn' : 'labelOff';
    }
    return 'label';
  }

  active(a: TagAction | ResponseAction | Icon) {
    return active(this.ref, a);
  }

  showIcon(i: Icon) {
    return this.visible(i) && this.active(i);
  }

  clickIcon(i: Icon, ctrl: boolean) {
    if (i.response) {
      this.bookmarks.toggleFilter(i.response);
    }
    if (i.tag) {
      this.bookmarks.toggleFilter((ctrl ? `query/!(${i.tag})` : `query/${i.tag}`));
    }
  }

  showAction(a: Action) {
    if (!this.visible(a)) return false;
    if ('tag' in a) {
      if (a.tag === 'locked' && !this.writeAccess) return false;
      if (a.tag && !this.taggingAccess) return false;
      if (a.tag && !this.auth.canAddTag(a.tag)) return false;
    }
    if ('tag' in a || 'response' in a) {
      if (this.active(a) && !a.labelOn) return false;
      if (!this.active(a) && !a.labelOff) return false;
    } else {
      if (!a.label) return false;
    }
    return true;
  }

  save() {
    this.submitted = true;
    this.editForm.markAllAsTouched();
    this.editor.syncEditor(this.fb, this.editForm);
    if (!this.editForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const tags = [...without(this.editForm.value.tags, ...this.admin.editorTags), ...this.editorPlugins];
    const published = moment(this.editForm.value.published, moment.HTML5_FMT.DATETIME_LOCAL_SECONDS);
    this.refs.update({
      ...this.ref,
      ...this.editForm.value,
      tags,
      published,
      plugins: writePlugins(tags, {
        ...this.ref.plugins,
        ...this.editForm.value.plugins
      }),
    }).pipe(
      switchMap(() => this.refs.get(this.ref.url, this.ref.origin)),
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(ref => {
      this.serverError = [];
      this.editing = false;
      this.ref = ref;
      this.init();
    });
  }

  delete$ = () => {
    this.serverError = [];
    return (this.admin.getPlugin('plugin/delete')
        ? this.refs.update(deleteNotice(this.ref)).pipe(map(() => {}))
        : this.refs.delete(this.ref.url, this.ref.origin)
    ).pipe(
      tap(() => this.deleted = true),
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    );
  }
}
