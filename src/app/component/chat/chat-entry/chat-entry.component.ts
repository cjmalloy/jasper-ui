import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, HostBinding, Input, ViewChild } from '@angular/core';
import { defer } from 'lodash-es';
import { catchError, switchMap, throwError } from 'rxjs';
import { Ref } from '../../../model/ref';
import { deleteNotice } from '../../../plugin/delete';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { RefService } from '../../../service/api/ref.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { AuthzService } from '../../../service/authz.service';
import { Store } from '../../../store/store';
import { authors, clickableLink, formatAuthor, TAGS_REGEX, trimCommentForTitle } from '../../../util/format';
import { printError } from '../../../util/http';
import { hasTag, tagOrigin } from '../../../util/tag';

@Component({
  selector: 'app-chat-entry',
  templateUrl: './chat-entry.component.html',
  styleUrls: ['./chat-entry.component.scss']
})
export class ChatEntryComponent {
  @HostBinding('class') css = 'chat-entry';
  @HostBinding('attr.tabindex') tabIndex = 0;
  tagRegex = TAGS_REGEX.source;

  _ref!: Ref;

  @Input()
  focused = false;
  @Input()
  loading = true;

  @ViewChild('inlineTag')
  inlineTag?: ElementRef;

  noComment: Ref = {} as any;
  repostRef?: Ref;
  tagging = false;
  deleting = false;
  deleted = false;
  writeAccess = false;
  taggingAccess = false;
  serverError: string[] = [];

  private _allowActions = false;

  constructor(
    public admin: AdminService,
    public store: Store,
    private auth: AuthzService,
    private exts: ExtService,
    private ts: TaggingService,
    private refs: RefService,
  ) { }

  @Input()
  set ref(ref: Ref) {
    this._ref = ref;
    this.writeAccess = this.auth.writeAccess(ref);
    this.taggingAccess = this.auth.taggingAccess(ref);
    if (this.ref && this.bareRepost && !this.repostRef) {
      this.refs.get(this.url, this.ref.origin)
        .subscribe(ref => {
          this.repostRef = ref;
          this.noComment = {
            ...ref,
            comment: ''
          };
        });
    } else {
      this.noComment = {
        ...this.ref,
        comment: ''
      };
    }
  }

  get ref() {
    return this._ref;
  }

  get title() {
    const title = (this.ref?.title || '').trim();
    const comment = (this.ref?.comment || '').trim();
    if (title) return title;
    if (this.focused) return '';
    if (!comment) {
      if (this.bareRepost) return $localize`Repost`;
      return this.url;
    }
    return trimCommentForTitle(comment);
  }

  get allowActions(): boolean {
    return this._allowActions || this.focused || this.tagging || this.deleting;
  }

  set allowActions(value: boolean) {
    if (value === this._allowActions) return;
    if (value) {
      defer(() => this._allowActions = value);
    } else {
      this._allowActions = false;
    }
  }

  get nonLocalOrigin() {
    if (this.ref.origin === this.store.account.origin) return undefined;
    return this.ref.origin || (this.store.account.origin ? '' : undefined);
  }

  get authors() {
    return authors(this.ref, this.store.view.ext?.config?.authorTags || []);
  }

  get authorExts$() {
    return this.exts.getCachedExts(this.authors);
  }

  get clickableLink() {
    return clickableLink(this.url);
  }

  get url() {
    return this.repost ? this.ref.sources![0] : this.ref.url;
  }

  get currentRef() {
    return this.repost ? this.repostRef : this.ref;
  }

  get bareRef() {
    return this.bareRepost ? this.repostRef : this.ref;
  }

  get repost() {
    return this.ref?.sources?.length && hasTag('plugin/repost', this.ref);
  }

  get bareRepost() {
    return this.repost && !this.ref.title && !this.ref.comment;
  }

  get approved() {
    return hasTag('_moderated', this.currentRef);
  }

  get locked() {
    return hasTag('locked', this.currentRef);
  }

  get qr() {
    return hasTag('plugin/qr', this.currentRef);
  }

  get audio() {
    return hasTag('plugin/audio', this.currentRef) ||
      this.admin.getPluginsForUrl(this.url).find(p => p.tag === 'plugin/audio');
  }

  get video() {
    return hasTag('plugin/video', this.currentRef) ||
      this.admin.getPluginsForUrl(this.url).find(p => p.tag === 'plugin/image');
  }

  get image() {
    return hasTag('plugin/image', this.currentRef) ||
      this.admin.getPluginsForUrl(this.url).find(p => p.tag === 'plugin/image');
  }

  get media() {
    return this.qr || this.audio || this.video || this.image;
  }

  get expand() {
    return this.currentRef?.comment || this.media;
  }

  get comments() {
    if (!this.admin.status.plugins.comment) return 0;
    return this.ref.metadata?.plugins?.['plugin/comment'] || 0;
  }

  formatAuthor(user: string) {
    if (this.store.account.origin && tagOrigin(user) === this.store.account.origin) {
      user = user.replace(this.store.account.origin, '');
    }
    return formatAuthor(user);
  }

  addInlineTag() {
    if (!this.inlineTag) return;
    const tag = (this.inlineTag.nativeElement.value as string).toLowerCase().trim();
    this.ts.create(tag, this.ref.url, this.ref.origin!).pipe(
      switchMap(() => this.refs.get(this.ref.url, this.ref.origin!)),
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(ref => {
      this.serverError = [];
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
      switchMap(() => this.refs.get(this.ref.url, this.ref.origin!)),
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(ref => {
      this.serverError = [];
      this.ref = ref;
    });
  }

  delete() {
    (this.admin.status.plugins.delete
        ? this.refs.update(deleteNotice(this.ref))
        : this.refs.delete(this.ref.url, this.ref.origin)
    ).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(() => {
      this.serverError = [];
      this.deleting = false;
      this.deleted = true;
    });
  }

}
