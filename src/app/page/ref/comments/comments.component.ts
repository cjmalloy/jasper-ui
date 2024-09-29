import { Component, OnDestroy, OnInit } from '@angular/core';
import { uniq } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { Subject } from 'rxjs';
import { Ref } from '../../../model/ref';
import { getMailbox, mailboxes } from '../../../mods/mailbox';
import { AdminService } from '../../../service/admin.service';
import { ModService } from '../../../service/mod.service';
import { Store } from '../../../store/store';
import { ThreadStore } from '../../../store/thread';
import { memo, MemoCache } from '../../../util/memo';
import { removeTag, top } from '../../../util/tag';

@Component({
  selector: 'app-ref-comments',
  templateUrl: './comments.component.html',
  styleUrls: ['./comments.component.scss'],
})
export class RefCommentsComponent implements OnInit, OnDestroy {
  private disposers: IReactionDisposer[] = [];
  newComments$ = new Subject<Ref | null>();

  constructor(
    private mod: ModService,
    public store: Store,
    public thread: ThreadStore,
    private admin: AdminService,
  ) {
    thread.clear();
    runInAction(() => store.view.defaultSort = ['published']);
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => this.mod.setTitle($localize`Comments: ` + (this.store.view.ref?.title || this.store.view.url))));
    this.disposers.push(autorun(() => {
      MemoCache.clear(this);
      const top = this.store.view.ref!;
      const sort = this.store.view.sort;
      const filter = this.store.view.filter;
      const search = this.store.view.search;
      runInAction(() => this.thread.setArgs(top, sort, filter, search));
    }));
    this.newComments$.subscribe(c => {
      if (c && this.store.view.ref) {
        this.store.view.ref.metadata ||= {};
        this.store.view.ref.metadata.plugins ||= {} as any;
        this.store.view.ref.metadata.plugins!['plugin/comment'] ||= 0;
        this.store.view.ref.metadata.plugins!['plugin/comment']++;
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
  get top() {
    return top(this.store.view.ref);
  }

  @memo
  get depth() {
    return this.store.view.depth || 7;
  }

  @memo
  get mailboxes() {
    return mailboxes(this.store.view.ref!, this.store.account.tag, this.store.origins.originMap);
  }

  @memo
  get replyExts() {
    return (this.store.view.ref!.tags || [])
      .map(tag => this.admin.getPlugin(tag))
      .flatMap(p => p?.config?.reply)
      .filter(t => !!t) as string[];
  }

  @memo
  get replyTags(): string[] {
    const tags = [
      'internal',
      'plugin/comment',
      ...this.admin.reply.filter(p => (this.store.view.ref?.tags || []).includes(p.tag)).flatMap(p => p.config!.reply as string[]),
      ...this.mailboxes,
      ...this.replyExts,
    ];
    return removeTag(getMailbox(this.store.account.tag, this.store.account.origin), uniq(tags));
  }
}
