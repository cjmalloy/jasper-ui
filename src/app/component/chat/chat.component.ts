import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { Component, HostBinding, Input, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as _ from 'lodash-es';
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
export class ChatComponent {
  @HostBinding('class') css = 'chat';

  @Input()
  addTags = ['public'];

  @ViewChild(CdkVirtualScrollViewport)
  viewport!: CdkVirtualScrollViewport;

  _query!: string;
  cursor?: string;
  loadingPrev = false;
  initialSize = 50;
  defaultPageSize = 20;
  messages?: Ref[];
  addText = '';
  sending: Ref[] = [];

  emoji = this.admin.status.plugins.emoji;
  latex = this.admin.status.plugins.latex;

  private timeoutId?: number;
  private pollInterval = 1000;

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

  get plugins() {
    const result = [];
    if (this.emoji) result.push('plugin/emoji');
    if (this.latex) result.push('plugin/latex');
    return result;
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
      this.setPoll();
      return throwError(() => err);
    })).subscribe(page => {
      this.setPoll();
      if (page.empty && this.messages) return;
      if (!this.messages) this.messages = [];
      this.messages = [...this.messages, ...page.content];
      this.cursor = page.content[page.content.length - 1]?.modifiedString;
      _.defer(() => this.viewport.scrollToIndex(this.messages!.length - 1, 'smooth'));
      _.pullAllWith(this.sending, page.content, (a, b) => a.url === b.url);
    });
  }

  loadPrev(scroll = false) {
    if (this.loadingPrev) return;
    this.loadingPrev = true;
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
      this.setPoll();
      return throwError(() => err);
    })).subscribe(page => {
      this.loadingPrev = false;
      this.setPoll();
      if (page.empty && this.messages) return;
      if (!this.messages) this.messages = [];
      this.cursor ??= page.content[0]?.modifiedString;
      this.messages = [...page.content.reverse(), ...this.messages];
      if (scroll) _.defer(() => this.viewport.scrollToIndex(this.messages!.length - 1, 'smooth'));
      _.pullAllWith(this.sending, page.content, (a, b) => a.url === b.url);
    });
  }

  clearPoll() {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId)
      this.timeoutId = undefined;
    }
  }

  setPoll() {
    this.clearPoll();
    this.timeoutId = window.setTimeout(() => this.loadMore(), this.pollInterval);
  }

  add() {
    this.addText = this.addText.trim();
    if (!this.addText) return;
    const newTags = _.uniq([
      ...this.addTags,
      ...this.plugins,
      this.store.account.tag]);
    const ref = URI_REGEX.test(this.addText) ? {
      url: this.addText,
      tags: newTags,
    } : {
      url: 'comment:' + uuid(),
      comment: this.addText,
      tags: newTags,
    };
    this.refs.create(ref).pipe(
      map(() => ref),
      catchError(err => {
        if (err.status === 409) {
          // Ref already exists, just tag it
          return this.tags.patch(this.addTags, ref.url).pipe(
            switchMap(() => this.refs.get(ref.url)),
          );
        }
        return throwError(err);
      }),
    ).subscribe(ref => {
      this.sending.push(ref);
    });
    this.addText = '';
  }

}
