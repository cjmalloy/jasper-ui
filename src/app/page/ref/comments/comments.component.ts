import { Component, viewChild, effect, inject, Injector, computed, untracked, afterNextRender, DestroyRef } from '@angular/core';
import { FakeLinkDirective } from '../../../directive/fake-link.directive';
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
import { hasTag, removeTag, updateMetadata } from '../../../util/tag';

@Component({
  selector: 'app-ref-comments',
  templateUrl: './comments.component.html',
  styleUrls: ['./comments.component.scss'],
  imports: [
    FakeLinkDirective,
    CommentReplyComponent,
    CommentThreadComponent,
    LoadingComponent,
  ],
})
export class RefCommentsComponent implements HasChanges {
  private mod = inject(ModService);
  store = inject(Store);
  thread = inject(ThreadStore);
  private admin = inject(AdminService);


  private readonly injector = inject(Injector);
  newComments$ = new Subject<Ref | undefined>();

  readonly reply = viewChild<CommentReplyComponent>('reply');

  constructor() {
    const store = this.store;
    const thread = this.thread;

    thread.clear();
    store.view.defaultSort.set(['published']);
  }

  saveChanges() {
    const reply = this.reply();
    return !reply || reply.saveChanges();
  }

  private readonly initialize = afterNextRender(() => {
    // TODO: set title for bare reposts
    effect(() => this.mod.setTitle($localize`Comments: ` + getTitle(this.store.view.ref())), { injector: this.injector });
    effect(() => {
      const top = this.store.view.url();
      const sort = this.store.view.sort();
      const filter = this.store.view.filter();
      const search = this.store.view.search();
      untracked(() => this.thread.setArgs(top, sort, filter, search));
      const ref = this.store.view.ref();
      if (ref) {
        const commentCount = ref.metadata?.plugins?.['plugin/comment'] || 0;
        this.store.local.setLastSeenCount(this.store.view.url(), 'comments', commentCount);
      }
    }, { injector: this.injector });
    this.newComments$.subscribe(c => {
      if (c && this.store.view.ref()) {
        updateMetadata(this.store.view.ref()!, c);
        this.store.eventBus.refresh(this.store.view.ref()!);
      }
    });
  });

  private readonly destroyCleanup = inject(DestroyRef).onDestroy(() => {
    this.newComments$.complete();
  });

  readonly depth = computed(() => this.store.view.depth() || 7);

  readonly comment = computed(() => this.admin.getPlugin('plugin/comment') && hasTag('plugin/comment', this.store.view.ref()));

  readonly mailboxes = computed(() => mailboxes(this.store.view.ref()!, this.store.account.tag(), this.store.origins.originMap()));

  readonly replyTags = computed((): string[] => {
    const tags = [
      'plugin/comment',
      'internal',
      ...this.admin.reply().filter(p => hasTag(p.tag, this.store.view.ref())).flatMap(p => p.config!.reply as string[]),
      ...this.mailboxes(),
    ];
    return removeTag(getMailbox(this.store.account.tag(), this.store.account.origin()), uniq(tags));
  });
}
