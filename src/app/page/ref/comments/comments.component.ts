import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  Injector,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { uniq } from 'lodash-es';

import { Subject } from 'rxjs';
import { CommentReplyComponent } from '../../../component/comment/comment-reply/comment-reply.component';
import { CommentThreadComponent } from '../../../component/comment/comment-thread/comment-thread.component';
import { LoadingComponent } from '../../../component/loading/loading.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Ref } from '../../../model/ref';
import { getMailbox, mailboxes } from '../../../mods/mailbox';
import { AdminService } from '../../../service/admin.service';
import { ModService } from '../../../service/mod.service';
import { Store } from '../../../store/store';
import { ThreadStore } from '../../../store/thread';
import { getTitle } from '../../../util/format';
import { memo, MemoCache } from '../../../util/memo';
import { hasTag, removeTag, updateMetadata } from '../../../util/tag';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-ref-comments',
  templateUrl: './comments.component.html',
  styleUrls: ['./comments.component.scss'],
  imports: [
    CommentReplyComponent,
    CommentThreadComponent,
    LoadingComponent,
  ],
})
export class RefCommentsComponent implements OnInit, OnDestroy, HasChanges {
  private injector = inject(Injector);
  private mod = inject(ModService);
  store = inject(Store);
  thread = inject(ThreadStore);
  private admin = inject(AdminService);

  newComments$ = new Subject<Ref | undefined>();

  @ViewChild('reply')
  reply?: CommentReplyComponent;

  constructor() {
    const store = this.store;
    const thread = this.thread;

    thread.clear();
    store.view.defaultSort = ['published'];
  }

  saveChanges() {
    return !this.reply || this.reply.saveChanges();
  }

  ngOnInit(): void {
    // TODO: set title for bare reposts
    effect(() => this.mod.setTitle($localize`Comments: ` + getTitle(this.store.view.ref)), { injector: this.injector });
    effect(() => {
      MemoCache.clear(this);
      const top = this.store.view.url;
      const sort = this.store.view.sort;
      const filter = this.store.view.filter;
      const search = this.store.view.search;
      this.thread.setArgs(top, sort, filter, search);
      if (this.store.view.ref) {
        const commentCount = this.store.view.ref.metadata?.plugins?.['plugin/comment'] || 0;
        this.store.local.setLastSeenCount(this.store.view.url, 'comments', commentCount);
      }
    }, { injector: this.injector });
    this.newComments$.subscribe(c => {
      if (c && this.store.view.ref) {
        updateMetadata(this.store.view.ref!, c);
        this.store.eventBus.refresh(this.store.view.ref!);
      }
    });
  }

  ngOnDestroy() {
    this.newComments$.complete();
  }

  @memo
  get depth() {
    return this.store.view.depth || 7;
  }

  @memo
  get comment() {
    return this.admin.getPlugin('plugin/comment') && hasTag('plugin/comment', this.store.view.ref);
  }

  @memo
  get mailboxes() {
    return mailboxes(this.store.view.ref!, this.store.account.tag, this.store.origins.originMap);
  }

  @memo
  get replyTags(): string[] {
    const tags = [
      'plugin/comment',
      'internal',
      ...this.admin.reply.filter(p => hasTag(p.tag, this.store.view.ref)).flatMap(p => p.config!.reply as string[]),
      ...this.mailboxes,
    ];
    return removeTag(getMailbox(this.store.account.tag, this.store.account.origin), uniq(tags));
  }
}
