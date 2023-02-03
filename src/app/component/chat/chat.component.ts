import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { Component, HostBinding, Input, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { defer, delay, pull, pullAllWith, uniq } from 'lodash-es';
import * as moment from 'moment';
import { catchError, map, switchMap, throwError } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { Ref } from '../../model/ref';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { TaggingService } from '../../service/api/tagging.service';
import { Store } from '../../store/store';
import { URI_REGEX } from '../../util/format';
import { getArgs } from '../../util/query';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnDestroy {
  @HostBinding('class') css = 'chat';
  itemSize = 18.5;

  @Input()
  addTags = ['public'];

  @ViewChild(CdkVirtualScrollViewport)
  viewport!: CdkVirtualScrollViewport;

  _query!: string;
  cursor?: string;
  loadingPrev = false;
  plugins = this.store.account.defaultEditors(['plugin/latex', 'plugin/emoji']);
  lastPoll = moment();
  initialSize = 50;
  messages?: Ref[];
  addText = '';
  sending: Ref[] = [];
  errored: Ref[] = [];
  scrollLock?: number;

  emoji = this.admin.status.plugins.emoji;
  latex = this.admin.status.plugins.latex;

  private timeoutId?: number;
  private retries = 0;
  private lastScrolled = 0;

  constructor(
    public admin: AdminService,
    private route: ActivatedRoute,
    private store: Store,
    private refs: RefService,
    private tags: TaggingService,
  ) { }

  @Input()
  set query(value: string) {
    this._query = value;
    this.clear();
  }

  get query() {
    return this._query;
  }

  get containerHeight() {
    return Math.max(300, Math.min(1000, this.itemSize * (this.messages?.length || 1)));
  }

  ngOnDestroy(): void {
    this.clearPoll();
  }

  clear() {
    this.messages = undefined;
    this.cursor = undefined;
    this.loadPrev(true);
  }

  loadMore() {
    this.clearPoll();
    if (!this.cursor) {
      this.loadPrev(true);
      return;
    }
    this.lastPoll = moment();
    this.refs.page({
      ...getArgs(
        this.query,
        'modified,ASC',
        this.store.view.filter,
        this.store.view.search,
        this.store.view.pageNumber,
        this.store.view.pageSize,
      ),
      modifiedAfter: this.cursor,
    }).pipe(catchError(err => {
      this.setPoll(true);
      return throwError(() => err);
    })).subscribe(page => {
      this.setPoll(page.empty);
      if (page.empty) return;
      if (!this.messages) this.messages = [];
      this.messages = [...this.messages, ...page.content];
      this.cursor = page.content[page.content.length - 1]?.modifiedString;
      pullAllWith(this.sending, page.content, (a, b) => a.url === b.url);
      defer(() => this.viewport.checkViewportSize());
      if (!this.scrollLock) this.scrollDown();
    });
  }

  loadPrev(scrollDown = false) {
    if (this.loadingPrev) return;
    this.loadingPrev = true;
    this.lastPoll = moment();
    this.refs.page({
      ...getArgs(
        this.query,
        'modified,DESC',
        this.store.view.filter,
        this.store.view.search,
        this.store.view.pageNumber,
        Math.max(this.store.view.pageSize, !this.cursor ? this.initialSize : 0),
      ),
      modifiedBefore: this.messages?.[0]?.modifiedString,
    }).pipe(catchError(err => {
      this.loadingPrev = false;
      this.setPoll(true);
      return throwError(() => err);
    })).subscribe(page => {
      this.loadingPrev = false;
      this.setPoll(page.empty);
      if (page.empty) return;
      if (!this.messages) this.messages = [];
      this.cursor ??= page.content[0]?.modifiedString;
      this.messages = [...page.content.reverse(), ...this.messages];
      pullAllWith(this.sending, page.content, (a, b) => a.url === b.url);
      defer(() => this.viewport.checkViewportSize());
      if (scrollDown) {
        this.retries = 0;
        this.scrollDown();
      } else {
        this.viewport.scrollToIndex(0, 'smooth');
      }
    });
  }

  scrollDown() {
    defer(() => {
      let wait = 0;
      if (this.lastScrolled < this.messages!.length / 2) {
        this.lastScrolled = Math.floor((this.lastScrolled + this.messages!.length) / 2);
        this.viewport.scrollToIndex(this.lastScrolled, 'smooth');
        wait += 400;
      }
      if (this.lastScrolled < this.messages!.length - 1) {
        this.lastScrolled = this.messages!.length - 1;
        delay(() => this.viewport.scrollToIndex(this.lastScrolled, 'smooth'), wait);
      }
    });
  }

  clearPoll() {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId)
      this.timeoutId = undefined;
    }
  }

  setPoll(backoff: boolean) {
    if (backoff) {
      this.retries++;
    } else {
      this.retries = 0;
    }
    this.clearPoll();
    this.timeoutId = window.setTimeout(() => this.loadMore(),
      // 1 second to ~4 minutes in 10 steps
      Math.max(1000, 250 * Math.pow(2, Math.min(10, this.retries))));
  }

  add() {
    this.addText = this.addText.trim();
    if (!this.addText) return;
    this.scrollLock = undefined;
    const newTags = uniq([
      ...this.addTags,
      ...this.plugins,
      this.store.account.localTag]);
    const ref = URI_REGEX.test(this.addText) ? {
      url: this.addText,
      tags: newTags,
    } : {
      url: 'comment:' + uuid(),
      comment: this.addText,
      tags: newTags,
    };
    this.addText = '';
    this.send(ref);
  }

  private send(ref: Ref) {
    this.sending.push(ref);
    this.refs.create(ref).pipe(
      map(() => ref),
      catchError(err => {
        if (err.status === 409) {
          // Ref already exists, just tag it
          return this.tags.patch(this.addTags, ref.url).pipe(
            switchMap(() => this.refs.get(ref.url)),
          );
        } else {
          pull(this.sending, ref);
          this.errored.push(ref);
        }
        return throwError(err);
      }),
    ).subscribe(ref => {
      this.setPoll(false);
    });
  }

  retry(ref: Ref) {
    pull(this.errored, ref);
    this.send(ref);
  }

}
