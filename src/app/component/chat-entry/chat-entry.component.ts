import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, HostBinding, Input, ViewChild } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { Ref } from '../../model/ref';
import { isAudio } from '../../plugin/audio';
import { deleteNotice } from '../../plugin/delete';
import { isImage } from '../../plugin/image';
import { isVideo } from '../../plugin/video';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { TaggingService } from '../../service/api/tagging.service';
import { AuthService } from '../../service/auth.service';
import { Store } from '../../store/store';
import { authors, TAGS_REGEX, webLink } from '../../util/format';
import { printError } from '../../util/http';
import { hasTag } from '../../util/tag';

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

  @ViewChild('inlineTag')
  inlineTag?: ElementRef;

  tagging = false;
  deleting = false;
  deleted = false;
  writeAccess = false;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    public store: Store,
    private auth: AuthService,
    private ts: TaggingService,
    private refs: RefService,
  ) { }

  @Input()
  set ref(ref: Ref) {
    this._ref = ref;
    this.writeAccess = this.auth.writeAccess(ref);
  }

  get ref() {
    return this._ref;
  }

  get origin() {
    return this.ref.origin || undefined;
  }

  get authors() {
    return authors(this.ref);
  }

  get webLink() {
    return webLink(this.ref);
  }

  get approved() {
    return hasTag('_moderated', this.ref);
  }

  get locked() {
    return hasTag('locked', this.ref);
  }

  get qr() {
    return hasTag('plugin/qr', this.ref);
  }

  get audio() {
    return isAudio(this.ref.url) || hasTag('plugin/audio', this.ref);
  }

  get video() {
    return isVideo(this.ref.url) || hasTag('plugin/video', this.ref);
  }

  get image() {
    return isImage(this.ref.url) || hasTag('plugin/image', this.ref);
  }

  get media() {
    return this.qr || this.audio || this.video || this.image;
  }

  get expand() {
    return this.ref.comment || this.media;
  }

  get comments() {
    if (!this.ref.metadata) return '? comments';
    const commentCount = this.ref.metadata.plugins?.['plugin/comment']?.length;
    if (commentCount === 0) return 'thread';
    if (commentCount === 1) return '1 comment';
    return commentCount + ' comments';
  }

  get qrWidth() {
    return Math.min(256, window.innerWidth);
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

  cssUrl(url: string) {
    return `url("${url}")`;
  }

}
