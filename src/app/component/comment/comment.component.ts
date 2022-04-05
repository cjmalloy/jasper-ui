import { Component, HostBinding, Input, OnDestroy, OnInit } from "@angular/core";
import { Ref } from "../../model/ref";
import { RefService } from "../../service/ref.service";
import { authors, interestingTags } from "../../util/format";
import { BehaviorSubject, mergeMap, Subject, takeUntil } from "rxjs";
import { inboxes } from "../../plugin/inbox";
import { AccountService } from "../../service/account.service";

@Component({
  selector: 'app-comment',
  templateUrl: './comment.component.html',
  styleUrls: ['./comment.component.scss']
})
export class CommentComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'comment';
  @HostBinding('attr.tabindex') tabIndex = 0;
  private destroy$ = new Subject<void>();

  @Input()
  top!: Ref;
  @Input()
  ref!: Ref;
  @Input()
  depth = 7;

  source$ = new BehaviorSubject<string>(null!);
  commentEdited$ = new Subject<void>();
  newComments$ = new Subject<Ref | undefined>();
  childCount?: number;
  responseCount?: number;
  sourceCount?: number;
  collapsed = false;
  replying = false;
  editing = false;
  deleting = false;

  constructor(
    private account: AccountService,
    private refs: RefService,
  ) { }

  ngOnInit(): void {
    this.refs.count({ query: 'plugin/comment@*', responses: this.ref.url }).subscribe(n => this.childCount = n);
    this.refs.count({ query: '!plugin/comment@*', responses: this.ref.url }).subscribe(n => this.responseCount = n);
    this.refs.count({ query: '!plugin/comment@*', sources: this.ref.url }).subscribe(n => this.sourceCount = n);
    this.newComments$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(ref => {
      this.replying = false;
      if (ref) {
        this.childCount = this.childCount! + 1;
        if (this.depth === 0) this.depth = 1;
      }
    });
    this.commentEdited$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => this.editing = false);
    this.source$.next(this.ref.url);
  }

  ngOnDestroy(): void {
    this.commentEdited$.complete();
    this.newComments$.complete();
    this.source$.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }

  get authors() {
    return authors(this.ref);
  }

  get inboxes() {
    return inboxes(this.ref, this.account.tag);
  }

  get tags() {
    return interestingTags(this.ref.tags);
  }

  get comments() {
    if (this.childCount === undefined) return '(? comments)';
    if (this.childCount === 1) return '(1 comment)';
    return `(${this.childCount} comments)`;
  }

  get responses() {
    if (this.responseCount === undefined) return '? citations';
    if (this.responseCount === 0) return 'uncited';
    if (this.responseCount === 1) return '1 citation';
    return this.responseCount + ' citations';
  }

  get sources() {
    if (this.sourceCount === undefined) return '? sources';
    if (this.sourceCount === 0) return 'unsourced';
    if (this.sourceCount === 1) return '1 source';
    return this.sourceCount + ' sources';
  }

  get writeAccess() {
    return this.account.writeAccess(this.ref);
  }

  watch() {
    window.alert('watch')
  }

  tag() {
    window.alert('tag')
  }

  delete() {
    this.refs.patch(this.ref.url, this.ref.origin!, [{
      op: 'add',
      path: '/plugins/plugin~1comment/deleted',
      value: true,
    }]).pipe(
      mergeMap(() => this.refs.get(this.ref.url, this.ref.origin!)),
    ).subscribe(ref => this.ref = ref);
  }
}
