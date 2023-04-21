import { Component, OnDestroy, OnInit } from '@angular/core';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { Subject } from 'rxjs';
import { Ref } from '../../../model/ref';
import { mailboxes } from '../../../plugin/mailbox';
import { ThemeService } from '../../../service/theme.service';
import { Store } from '../../../store/store';
import { ThreadStore } from '../../../store/thread';
import { hasTag } from '../../../util/tag';

@Component({
  selector: 'app-ref-comments',
  templateUrl: './comments.component.html',
  styleUrls: ['./comments.component.scss'],
})
export class RefCommentsComponent implements OnInit, OnDestroy {
  private disposers: IReactionDisposer[] = [];
  newComments$ = new Subject<Ref | null>();

  constructor(
    private theme: ThemeService,
    public store: Store,
    public thread: ThreadStore,
  ) {
    thread.clear();
    runInAction(() => store.view.defaultSort = 'published');
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => this.theme.setTitle($localize`Comments: ` + (this.store.view.ref?.title || this.store.view.url))));
    this.disposers.push(autorun(() => {
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

  get top() {
    if (hasTag('plugin/comment', this.store.view.ref)) {
      return this.store.view.ref?.sources?.[1] || this.store.view.ref?.sources?.[0];
    }
    return this.store.view.ref?.url;
  }

  get depth() {
    return this.store.view.depth || 7;
  }

  get mailboxes() {
    return mailboxes(this.store.view.ref!, this.store.account.tag, this.store.origins.originMap);
  }
}
