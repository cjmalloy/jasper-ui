import { Component, HostBinding } from '@angular/core';
import { defer, uniq } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { Subject, Subscription, switchMap, takeUntil } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Ref } from '../../../model/ref';
import { getMailbox, mailboxes } from '../../../mods/mailbox';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { StompService } from '../../../service/api/stomp.service';
import { ConfigService } from '../../../service/config.service';
import { ThemeService } from '../../../service/theme.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getArgs } from '../../../util/query';
import { hasTag, removeTag } from '../../../util/tag';

@Component({
  selector: 'app-ref-thread',
  templateUrl: './thread.component.html',
  styleUrls: ['./thread.component.scss']
})
export class RefThreadComponent {
  @HostBinding('class') css = 'thread';

  private disposers: IReactionDisposer[] = [];
  private destroy$ = new Subject<void>();

  newRefs$ = new Subject<Ref | null>();

  private watch?: Subscription;

  constructor(
    public config: ConfigService,
    private theme: ThemeService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
    private stomp: StompService,
    private refs: RefService,
  ) {
    query.clear();
    runInAction(() => store.view.defaultSort = 'published,ASC');
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      const args = getArgs(
        'plugin/thread',
        this.store.view.sort,
        this.store.view.filter,
        this.store.view.search,
        this.store.view.pageNumber,
        this.store.view.pageSize,
      );
      args.responses = this.store.view.url;
      defer(() => this.query.setArgs(args));
    }));
    this.disposers.push(autorun(() => {
      this.theme.setTitle($localize`Thread: ` + (this.store.view.ref?.title || this.store.view.url));
    }));
    this.disposers.push(autorun(() => {
      if (this.store.view.ref && this.config.websockets) {
        this.watch?.unsubscribe();
        this.watch = this.stomp.watchResponse(this.top!).pipe(
          takeUntil(this.destroy$),
          switchMap(url => this.refs.page({ url, obsolete: true, size: 1 }))
        ).subscribe(page => {
          if (this.query.page?.last) {
            this.newRefs$.next(page.content[0]);
          }
        });
      }
    }));
    this.newRefs$.subscribe(c => {
      if (c && this.store.view.ref) {
        this.store.view.ref.metadata ||= {};
        this.store.view.ref.metadata.plugins ||= {} as any;
        this.store.view.ref.metadata.plugins!['plugin/thread'] ||= 0;
        this.store.view.ref.metadata.plugins!['plugin/thread']++;
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  get top() {
    if (hasTag('plugin/comment', this.store.view.ref) || hasTag('plugin/thread', this.store.view.ref)) {
      return this.store.view.ref?.sources?.[1] || this.store.view.ref?.sources?.[0] || this.store.view.ref?.url;
    }
    return this.store.view.ref?.url;
  }

  get mailboxes() {
    return mailboxes(this.store.view.ref!, this.store.account.tag, this.store.origins.originMap);
  }

  get replyTags(): string[] {
    const tags = [
      'internal',
      'plugin/thread',
      ...this.admin.reply.filter(p => (this.store.view.ref?.tags || []).includes(p.tag)).flatMap(p => p.config!.reply as string[]),
      ...this.mailboxes,
    ];
    if (hasTag('public', this.store.view.ref)) tags.unshift('public');
    if (hasTag('plugin/email', this.store.view.ref)) tags.push('plugin/email');
    if (hasTag('plugin/thread', this.store.view.ref)) tags.push('plugin/thread');
    return removeTag(getMailbox(this.store.account.tag, this.store.account.origin), uniq(tags));
  }

}
