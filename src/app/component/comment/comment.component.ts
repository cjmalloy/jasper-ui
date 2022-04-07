import { Component, ElementRef, HostBinding, Input, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { Ref } from "../../model/ref";
import { RefService } from "../../service/api/ref.service";
import { authors, interestingTags } from "../../util/format";
import { BehaviorSubject, mergeMap, Observable, Subject, takeUntil } from "rxjs";
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
  depth?: number | null = 7;

  @ViewChild('inlineTag')
  inlineTag?: ElementRef;

  source$ = new BehaviorSubject<string>(null!);
  commentEdited$ = new Subject<void>();
  newComments$ = new Subject<Ref | null>();
  collapsed = false;
  replying = false;
  editing = false;
  tagging = false;
  deleting = false;
  writeAccess$?: Observable<boolean>;

  constructor(
    private account: AccountService,
    private refs: RefService,
  ) { }

  ngOnInit(): void {
    this.writeAccess$ = this.account.writeAccess(this.ref);
    this.newComments$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(ref => {
      this.replying = false;
      if (ref?.metadata) {
        this.ref.metadata!.comments.push(ref.url);
        this.ref.metadata!.responses.push(ref.url);
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
    if (!this.ref.metadata) return '? comments';
    const commentCount = this.ref.metadata.comments.length;
    if (commentCount === 0) return 'comment';
    if (commentCount === 1) return '1 comment';
    return commentCount + ' comments';
  }

  get responses() {
    if (!this.ref.metadata) return '? citations';
    const responseCount = this.ref.metadata.responses.length - this.ref.metadata.comments.length;
    if (responseCount === 0) return 'uncited';
    if (responseCount === 1) return '1 citation';
    return responseCount + ' citations';
  }

  get sources() {
    const sourceCount = this.ref.sources?.length || 0;
    if (sourceCount === 0) return 'unsourced';
    if (sourceCount === 1) return '1 source';
    return sourceCount + ' sources';
  }

  addInlineTag() {
    if (!this.inlineTag) return;
    const tag = this.inlineTag.nativeElement.value;
    this.refs.patch(this.ref.url, this.ref.origin!, [{
      op: 'add',
      path: '/tags/-',
      value: tag,
    }]).pipe(
      mergeMap(() => this.refs.get(this.ref.url, this.ref.origin!)),
    ).subscribe(ref => {
      this.tagging = false;
      this.ref = ref;
    });
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
