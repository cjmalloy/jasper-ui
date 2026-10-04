import { DestroyRef, inject, Component, viewChild, effect, Injector, signal, computed, untracked, afterNextRender } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { uniq } from 'lodash-es';
import { catchError, filter, of, Subject, Subscription, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CommentReplyComponent } from '../../../component/comment/comment-reply/comment-reply.component';
import { LoadingComponent } from '../../../component/loading/loading.component';
import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Ref } from '../../../model/ref';
import { getMailbox, mailboxes } from '../../../mods/mailbox';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { StompService } from '../../../service/api/stomp.service';
import { ConfigService } from '../../../service/config.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getTitle } from '../../../util/format';
import { getArgs } from '../../../util/query';
import { hasTag, removeTag, top, updateMetadata } from '../../../util/tag';

@Component({
  selector: 'app-ref-thread',
  templateUrl: './thread.component.html',
  styleUrls: ['./thread.component.scss'],
  host: { 'class': 'thread' },
  imports: [RefListComponent, LoadingComponent, CommentReplyComponent]
})
export class RefThreadComponent implements HasChanges {
  config = inject(ConfigService);
  private mod = inject(ModService);
  admin = inject(AdminService);
  store = inject(Store);
  query = inject(QueryStore);
  private stomp = inject(StompService);
  private refs = inject(RefService);


  private readonly injector = inject(Injector);

  private readonly lastRef = signal<Ref | undefined>(this.store.view.ref());
  readonly to = computed<Ref>(() => this.lastRef() || this.store.view.ref()!);
  private destroyRef = inject(DestroyRef);

  readonly reply = viewChild<CommentReplyComponent>('reply');
  readonly list = viewChild<RefListComponent>('list');

  newRefs$ = new Subject<Ref | undefined>();

  private watchUrl = '';
  private watch?: Subscription;

  constructor() {
    const store = this.store;
    store.view.defaultSort.set(['published,ASC']);
    this.query.watch(() => ({
      ...getArgs(
        'plugin/thread:!plugin/delete',
        this.store.view.sort(),
        this.store.view.filter(),
        this.store.view.search(),
        this.store.view.pageNumber(),
        this.store.view.pageSize(),
      ),
      responses: this.store.view.url(),
    }));
  }

  saveChanges() {
    const reply = this.reply();
    const list = this.list();
    return (!reply || reply.saveChanges())
      && (!list || list.saveChanges());
  }

  private readonly initialize = afterNextRender(() => {
    effect(() => {
      if (this.store.view.pageSize()) {
        this.store.view.defaultPageNumber.set(Math.floor(((this.to()?.metadata?.plugins?.['plugin/thread'] || 1) - 1) / this.store.view.pageSize()));
      }
    }, { injector: this.injector });
    // TODO: set title for bare reposts
    effect(() => this.mod.setTitle($localize`Thread: ` + getTitle(this.store.view.ref())), { injector: this.injector });
    effect(() => {
      this.store.view.ref();
      this.store.view.url();
      untracked(() => {
        const ref = this.store.view.ref();
        if (ref) {
          const threadCount = ref.metadata?.plugins?.['plugin/thread'] || 0;
          this.store.local.setLastSeenCount(this.store.view.url(), 'threads', threadCount);
        }
        if (this.store.view.ref() && this.config.websockets) {
          const topUrl = top(this.store.view.ref());
          if (this.watchUrl !== topUrl) {
            this.watchUrl = topUrl;
            this.watch?.unsubscribe();
            this.watch = this.stomp.watchResponse(topUrl).pipe(
              switchMap(url => this.refs.getCurrent(url)), // TODO: fix race conditions
              tap(ref => updateMetadata(this.store.view.ref()!, ref)),
              filter(ref => hasTag('plugin/thread', ref)),
              catchError(err => of(undefined)),
              takeUntilDestroyed(this.destroyRef),
            ).subscribe(ref => this.newRefs$.next(ref));
          }
        }
      });
    }, { injector: this.injector });
    effect(() => {
      if (this.query.page()) {
        this.lastRef.set(this.query.page()?.content?.filter(ref => !hasTag('+plugin/placeholder', ref))?.[(this.query.page()?.content?.length || 0) - 1] || this.store.view.ref());
      }
    }, { injector: this.injector });
    this.newRefs$.subscribe(c => {
      if (c && this.store.view.ref()) {
        if (hasTag('plugin/thread', c) && !hasTag('+plugin/placeholder', c) && (!this.to() || c.published! > this.to().published!)) {
          this.lastRef.set(c);
        }
      }
    });
  });

  readonly thread = computed(() => this.admin.getPlugin('plugin/thread') && hasTag('plugin/thread', this.store.view.ref()));

  readonly mailboxes = computed(() => this.to() ? mailboxes(this.to(), this.store.account.tag(), this.store.origins.originMap()) : []);

  readonly replyTags = computed((): string[] => {
    const tags = [
      'plugin/thread',
      'internal',
      ...this.admin.reply().filter(p => hasTag(p.tag, this.store.view.ref())).flatMap(p => p.config!.reply as string[]),
      ...this.mailboxes(),
    ];
    return removeTag(getMailbox(this.store.account.tag(), this.store.account.origin()), uniq(tags));
  });

}
