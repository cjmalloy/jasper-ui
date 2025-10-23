import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { uniq } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { MobxAngularModule } from 'mobx-angular';
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
    selector: 'app-ref-comments',
    templateUrl: './comments.component.html',
    styleUrls: ['./comments.component.scss'],
    imports: [
        MobxAngularModule,
        CommentReplyComponent,
        CommentThreadComponent,
        LoadingComponent,
    ],
})
export class RefCommentsComponent implements OnInit, OnDestroy, HasChanges {
  private disposers: IReactionDisposer[] = [];
  newComments$ = new Subject<Ref | undefined>();

  @ViewChild(CommentReplyComponent)
  reply?: CommentReplyComponent;

  constructor(
    private mod: ModService,
    public store: Store,
    public thread: ThreadStore,
    private admin: AdminService,
  ) {
    thread.clear();
    runInAction(() => store.view.defaultSort = ['published']);
  }

  saveChanges() {
    return !this.reply || this.reply.saveChanges();
  }

  ngOnInit(): void {
    // TODO: set title for bare reposts
    this.disposers.push(autorun(() => this.mod.setTitle($localize`Comments: ` + getTitle(this.store.view.ref))));
    this.disposers.push(autorun(() => {
      MemoCache.clear(this);
      const top = this.store.view.url;
      const sort = this.store.view.sort;
      const filter = this.store.view.filter;
      const search = this.store.view.search;
      runInAction(() => this.thread.setArgs(top, sort, filter, search));
    }));
    this.newComments$.subscribe(c => {
      if (c && this.store.view.ref) {
        runInAction(() => updateMetadata(this.store.view.ref!, c));
        this.store.eventBus.refresh(this.store.view.ref!);
      }
    });
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
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
