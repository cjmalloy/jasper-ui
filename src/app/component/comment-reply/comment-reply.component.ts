import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input } from '@angular/core';
import { FormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { uniq } from 'lodash-es';
import { runInAction } from 'mobx';
import * as moment from 'moment';
import { catchError, Subject, switchMap, throwError } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { Ref } from '../../model/ref';
import { getMailbox } from '../../plugin/mailbox';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { EditorService } from '../../service/editor.service';
import { Store } from '../../store/store';
import { ThreadStore } from '../../store/thread';
import { getMailboxes, getTags } from '../../util/editor';
import { printError } from '../../util/http';
import { hasTag, removeTag } from '../../util/tag';

@Component({
  selector: 'app-comment-reply',
  templateUrl: './comment-reply.component.html',
  styleUrls: ['./comment-reply.component.scss'],
})
export class CommentReplyComponent {
  @HostBinding('class') css = 'comment-reply';

  @Input()
  to!: Ref;
  @Input()
  top?: Ref;
  @Input()
  tags: string[] = [];
  @Input()
  newComments$!: Subject<Ref | null>;
  @Input()
  showCancel = false;
  @Input()
  autofocus = false;

  commentForm: UntypedFormGroup;
  plugins: string[] = [];
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    public store: Store,
    private thread: ThreadStore,
    private editor: EditorService,
    private refs: RefService,
    private fb: FormBuilder,
  ) {
    this.commentForm = fb.group({
      comment: [''],
    });
  }

  get publicTag() {
    if (!hasTag('public', this.to)) return [];
    return ['public'];
  }

  get comment() {
    return this.commentForm.get('comment') as UntypedFormControl;
  }

  reply() {
    if (!this.comment.value) return;
    const url = 'comment:' + uuid();
    const value = this.comment.value;
    this.comment.setValue('');
    this.refs.create({
      url,
      origin: this.store.account.origin,
      title: 'Reply to: ' + this.to.title,
      comment: value,
      sources: uniq([
        this.to.url,
        ...(this.top ? [this.top.url] : []),
        ...this.editor.getSources(value),
      ]),
      alternateUrls: this.editor.getAlts(value),
      tags: removeTag(getMailbox(this.store.account.tag), uniq([
        ...this.publicTag,
        'internal',
        'plugin/comment',
        this.store.account.localTag,
        ...this.tags!,
        ...this.plugins,
        ...getTags(value),
        ...getMailboxes(value),
      ])),
      published: moment(),
    }).pipe(
      switchMap(() => this.refs.get(url)),
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        this.comment.setValue(value);
        return throwError(() => err);
      }),
    ).subscribe(ref => {
      this.serverError = [];
      this.newComments$.next(ref);
    });
  }

  cancel() {
    this.newComments$.next(null);
    this.comment.setValue('');
  }
}
