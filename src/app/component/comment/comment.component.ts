import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, HostBinding, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { catchError, Subject, switchMap, takeUntil, throwError } from 'rxjs';
import { Ref, RefSort } from '../../model/ref';
import { inboxes } from '../../plugin/inbox';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { TaggingService } from '../../service/api/tagging.service';
import { AuthService } from '../../service/auth.service';
import { Store } from '../../store/store';
import { authors, interestingTags, TAG_REGEX_STRING } from '../../util/format';
import { printError } from '../../util/http';

@Component({
  selector: 'app-comment',
  templateUrl: './comment.component.html',
  styleUrls: ['./comment.component.scss'],
})
export class CommentComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'comment';
  @HostBinding('attr.tabindex') tabIndex = 0;
  private destroy$ = new Subject<void>();
  tagRegex = TAG_REGEX_STRING;

  maxContext = 20;

  @Input()
  top!: Ref;
  @Input()
  sort?: RefSort;
  @Input()
  depth?: number | null = 7;
  @Input()
  context = 0;

  @ViewChild('inlineTag')
  inlineTag?: ElementRef;

  _ref!: Ref;
  commentEdited$ = new Subject<Ref>();
  newComments$ = new Subject<Ref | null>();
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
    private auth: AuthService,
    private refs: RefService,
    private tags: TaggingService,
  ) { }

  get ref(): Ref {
    return this._ref;
  }

  get origin() {
    return this._ref.origin || undefined;
  }

  @Input()
  set ref(value: Ref) {
    this._ref = value;
    this.writeAccess = this.auth.writeAccess(this._ref);
  }

  ngOnInit(): void {
    this.newComments$.pipe(
      takeUntil(this.destroy$),
    ).subscribe(ref => {
      this.replying = false;
      if (ref?.metadata) {
        this._ref.metadata!.plugins['plugin/comment'].push(ref.url);
        this._ref.metadata!.responses.push(ref.url);
        if (this.depth === 0) this.depth = 1;
      }
    });
    this.commentEdited$.pipe(
      takeUntil(this.destroy$),
    ).subscribe(ref => {
      this.editing = false;
      this._ref = ref;
    });
  }

  ngOnDestroy(): void {
    this.commentEdited$.complete();
    this.newComments$.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }

  get emoji() {
    return !!this.admin.status.plugins.emoji && !!this._ref.tags?.includes('plugin/emoji');
  }

  get latex() {
    return !!this.admin.status.plugins.latex && !!this._ref.tags?.includes('plugin/latex');
  }

  get canInvoice() {
    if (this._ref.origin) return false;
    if (!this.admin.status.plugins.invoice) return false;
    if (!this.isAuthor) return false;
    if (!this._ref.sources || !this._ref.sources.length) return false;
    return this._ref.tags?.includes('plugin/comment') ||
      !this._ref.tags?.includes('internal');
  }

  get isAuthor() {
    return this.authors.includes(this.store.account.tag);
  }

  get authors() {
    return authors(this._ref);
  }

  get inboxes() {
    return inboxes(this._ref, this.store.account.tag);
  }

  get tagged() {
    return interestingTags(this._ref.tags);
  }

  get approved() {
    return this._ref.tags?.includes('_moderated');
  }

  get locked() {
    return this._ref.tags?.includes('locked');
  }

  get comments() {
    if (!this._ref.metadata) return '? comments';
    const commentCount = this._ref.metadata.plugins['plugin/comment'].length;
    if (commentCount === 0) return 'comment';
    if (commentCount === 1) return '1 comment';
    return commentCount + ' comments';
  }

  get responses() {
    if (!this._ref.metadata) return '? citations';
    const responseCount = this._ref.metadata.responses.length;
    if (responseCount === 0) return 'uncited';
    if (responseCount === 1) return '1 citation';
    return responseCount + ' citations';
  }

  get sources() {
    const sourceCount = this._ref.sources?.length || 0;
    if (sourceCount === 0) return 'unsourced';
    if (sourceCount === 1) return '1 source';
    return sourceCount + ' sources';
  }

  addInlineTag() {
    if (!this.inlineTag) return;
    const tag = (this.inlineTag.nativeElement.value as string).toLowerCase();
    this.tags.create(tag, this._ref.url, this._ref.origin!).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
      switchMap(() => this.refs.get(this._ref.url, this._ref.origin!)),
    ).subscribe(ref => {
      this.serverError = [];
      this.tagging = false;
      this._ref = ref;
    });
  }

  approve() {
    this.tags.create('_moderated', this._ref.url, this._ref.origin!).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
      switchMap(() => this.refs.get(this._ref.url, this._ref.origin!)),
    ).subscribe(ref => {
      this.serverError = [];
      this._ref = ref;
    });
  }

  delete() {
    this.refs.patch(this._ref.url, this._ref.origin!, [{
      op: 'add',
      path: '/plugins/plugin~1comment/deleted',
      value: true,
    }]).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
      switchMap(() => this.refs.get(this._ref.url, this._ref.origin!)),
    ).subscribe(ref => {
      this.serverError = [];
      this._ref = ref;
    });
  }
}
