import { Component, ElementRef, HostBinding, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { mergeMap, Observable, Subject, takeUntil } from 'rxjs';
import { Ref } from '../../model/ref';
import { inboxes } from '../../plugin/inbox';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { authors, interestingTags } from '../../util/format';

@Component({
  selector: 'app-comment',
  templateUrl: './comment.component.html',
  styleUrls: ['./comment.component.scss'],
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
  filter?: string | null;
  @Input()
  depth?: number | null = 7;

  @ViewChild('inlineTag')
  inlineTag?: ElementRef;

  commentEdited$ = new Subject<void>();
  newComments$ = new Subject<Ref | null>();
  collapsed = false;
  replying = false;
  editing = false;
  tagging = false;
  deleting = false;
  writeAccess$?: Observable<boolean>;

  constructor(
    public admin: AdminService,
    public account: AccountService,
    private refs: RefService,
  ) { }

  ngOnInit(): void {
    this.writeAccess$ = this.account.writeAccess(this.ref);
    this.newComments$.pipe(
      takeUntil(this.destroy$),
    ).subscribe(ref => {
      this.replying = false;
      if (ref?.metadata) {
        this.ref.metadata!.plugins['plugin/comment'].push(ref.url);
        this.ref.metadata!.responses.push(ref.url);
        if (this.depth === 0) this.depth = 1;
      }
    });
    this.commentEdited$.pipe(
      takeUntil(this.destroy$),
    ).subscribe(() => this.editing = false);
  }

  ngOnDestroy(): void {
    this.commentEdited$.complete();
    this.newComments$.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }

  get emoji() {
    return !!this.admin.status.plugins.emoji && !!this.ref.tags?.includes('plugin/emoji');
  }

  get latex() {
    return !!this.admin.status.plugins.latex && !!this.ref.tags?.includes('plugin/latex');
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

  get approved() {
    return this.ref.tags?.includes('_moderated');
  }

  get comments() {
    if (!this.ref.metadata) return '? comments';
    const commentCount = this.ref.metadata.plugins['plugin/comment'].length;
    if (commentCount === 0) return 'comment';
    if (commentCount === 1) return '1 comment';
    return commentCount + ' comments';
  }

  get responses() {
    if (!this.ref.metadata) return '? citations';
    const responseCount = this.ref.metadata.responses.length;
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

  approve() {
    this.refs.patch(this.ref.url, this.ref.origin!, [{
      op: 'add',
      path: '/tags/-',
      value: '_moderated',
    }]).pipe(
      mergeMap(() => this.refs.get(this.ref.url, this.ref.origin!)),
    ).subscribe(ref => this.ref = ref);
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
