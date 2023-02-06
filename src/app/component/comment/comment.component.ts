import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { filter, uniq } from 'lodash-es';
import { catchError, Observable, Subject, switchMap, takeUntil, throwError } from 'rxjs';
import { Action, active, Icon, Visibility, visible } from '../../model/plugin';
import { Ref } from '../../model/ref';
import { mailboxes } from '../../plugin/mailbox';
import { ActionService } from '../../service/action.service';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { TaggingService } from '../../service/api/tagging.service';
import { AuthzService } from '../../service/authz.service';
import { Store } from '../../store/store';
import { authors, formatAuthor, interestingTags, TAGS_REGEX } from '../../util/format';
import { printError } from '../../util/http';
import { hasPrefix, hasTag, tagOrigin } from '../../util/tag';

@Component({
  selector: 'app-comment',
  templateUrl: './comment.component.html',
  styleUrls: ['./comment.component.scss'],
})
export class CommentComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'comment';
  @HostBinding('attr.tabindex') tabIndex = 0;
  private destroy$ = new Subject<void>();
  tagRegex = TAGS_REGEX.source;

  maxContext = 20;

  @Input()
  top!: Ref;
  @Input()
  depth?: number | null = 7;
  @Input()
  context = 0;

  _ref!: Ref;
  commentEdited$ = new Subject<Ref>();
  newComments$ = new Subject<Ref | null>();
  icons: Icon[] = [];
  actions: Action[] = [];
  collapsed = false;
  replying = false;
  editing = false;
  tagging = false;
  deleting = false;
  writeAccess = false;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    public store: Store,
    private router: Router,
    private auth: AuthzService,
    private refs: RefService,
    private acts: ActionService,
    private ts: TaggingService,
  ) { }

  get ref(): Ref {
    return this._ref;
  }

  get origin() {
    return this.ref.origin || undefined;
  }

  @Input()
  set ref(value: Ref) {
    this._ref = value;
    this.deleting = false;
    this.editing = false;
    this.tagging = false;
    this.collapsed = this.store.local.isRefToggled(this.ref.url, false);
    this.writeAccess = this.auth.writeAccess(this.ref);
    this.icons = this.admin.getIcons(value.tags);
    this.actions = this.admin.getActions(value.tags).filter(a => a.response || this.auth.tagReadAccess(a.tag));
  }

  ngOnInit(): void {
    this.newComments$.pipe(
      takeUntil(this.destroy$),
    ).subscribe(ref => {
      this.replying = false;
      if (ref) {
        this.ref.metadata ||= {};
        this.ref.metadata.plugins ||= {};
        this.ref.metadata.plugins['plugin/comment'] ||= 0;
        this.ref.metadata.plugins['plugin/comment']++;
        if (this.depth === 0) this.depth = 1;
      }
    });
    this.commentEdited$.pipe(
      takeUntil(this.destroy$),
    ).subscribe(ref => {
      this.editing = false;
      this.ref = ref;
    });
  }

  ngOnDestroy(): void {
    this.commentEdited$.complete();
    this.newComments$.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private runAndLoad(observable: Observable<any>) {
    observable.pipe(
      switchMap(() => this.refs.get(this.ref.url, this.ref.origin!)),
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(ref => {
      this.serverError = [];
      this.ref = ref;
    });
  }

  get emoji() {
    return !!this.admin.status.plugins.emoji && hasTag('plugin/emoji', this.ref);
  }

  get latex() {
    return !!this.admin.status.plugins.latex && hasTag('plugin/latex', this.ref);
  }

  get canInvoice() {
    if (this.ref.origin) return false;
    if (!this.admin.status.plugins.invoice) return false;
    if (!this.isAuthor) return false;
    if (!this.ref.sources || !this.ref.sources.length) return false;
    return hasTag('plugin/comment', this.ref) ||
      !hasTag('internal', this.ref);
  }

  get isAuthor() {
    return this.authors.includes(this.store.account.tag);
  }

  get isRecipient() {
    return hasTag(this.store.account.mailbox, this.ref);
  }

  get authors() {
    return authors(this.ref);
  }

  get mailboxes() {
    return mailboxes(this.ref, this.store.account.tag, this.store.origins.originMap);
  }

  get tagged() {
    return interestingTags(this.ref.tags);
  }

  get deleted() {
    return hasTag('plugin/deleted', this.ref);
  }

  get comments() {
    return this.ref.metadata?.plugins?.['plugin/comment'] || 0;
  }

  get responses() {
    return this.ref.metadata?.responses || 0;
  }

  get sources() {
    return this.ref.sources?.length || 0;
  }

  formatAuthor(user: string) {
    if (this.store.account.origin && tagOrigin(user) === this.store.account.origin) {
      user = user.replace(this.store.account.origin, '');
    }
    return formatAuthor(user);
  }

  addInlineTag(field: HTMLInputElement) {
    if (field.validity.patternMismatch) {
      this.serverError = [$localize`
        Tags must be lower case letters, numbers, periods and forward slashes.
        Must not start with a forward slash or period.
        Must not or contain two forward slashes or periods in a row.
        Protected tags start with a plus sign.
        Private tags start with an underscore.`];
      return;
    }
    this.runAndLoad(this.ts.create(field.value.trim(), this.ref.url, this.ref.origin!));
  }

  visible(v: Visibility) {
    return visible(v, this.isAuthor, this.isRecipient);
  }

  active(a: Action | Icon) {
    return active(this.ref, a);
  }

  showIcon(i: Icon) {
    return this.visible(i) && this.active(i);
  }

  clickIcon(i: Icon) {
    if (i.response) {
      this.router.navigate([], { queryParams: { filter: this.store.view.toggleFilter(i.response) }, queryParamsHandling: 'merge' });
    }
    if (i.tag) {
      this.router.navigate(['/tag', this.store.view.toggleTag(i.tag)], { queryParamsHandling: 'merge' });
    }
  }

  showAction(a: Action) {
    if (a.tag && !this.writeAccess) return false;
    if (!this.visible(a)) return false;
    if (this.active(a) && !a.labelOn) return false;
    if (!this.active(a) && !a.labelOff) return false;
    return true;
  }

  doAction(a: Action) {
    this.runAndLoad(this.acts.apply(this.ref, a));
  }

  delete() {
    delete this.ref.title;
    delete this.ref.comment;
    delete this.ref.plugins;
    this.runAndLoad(this.refs.update({
      ...this.ref,
      tags: uniq([...filter(this.ref.tags, t => !hasPrefix(t, 'plugin')), 'plugin/comment', 'plugin/deleted']),
    }));
  }
}
