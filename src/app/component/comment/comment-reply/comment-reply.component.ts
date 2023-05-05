import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, ViewChild } from '@angular/core';
import { FormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { uniq } from 'lodash-es';
import * as moment from 'moment';
import { catchError, Subject, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { Ref } from '../../../model/ref';
import { commentPlugin } from '../../../plugin/comment';
import { getMailbox } from '../../../plugin/mailbox';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { EditorService } from '../../../service/editor.service';
import { Store } from '../../../store/store';
import { ThreadStore } from '../../../store/thread';
import { getMailboxes, getTags } from '../../../util/editor';
import { printError } from '../../../util/http';
import { hasTag, removeTag } from '../../../util/tag';
import { EditorComponent } from '../../editor/editor.component';

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
  top?: string;
  @Input()
  tags: string[] = [];
  @Input()
  newComments$?: Subject<Ref|null>;
  @Input()
  showCancel = false;
  @Input()
  autofocus = false;

  @ViewChild(EditorComponent)
  editor?: EditorComponent;

  commentForm: UntypedFormGroup;
  plugins: string[] = [];
  serverError: string[] = [];
  config = this.admin.getPlugin('plugin/comment')?.config || commentPlugin.config!;

  constructor(
    public admin: AdminService,
    public store: Store,
    private thread: ThreadStore,
    private ed: EditorService,
    private refs: RefService,
    private ts: TaggingService,
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
    this.editor?.syncText('');
    const ref = {
      url,
      origin: this.store.account.origin,
      comment: value,
      sources: uniq([
        this.to.url,
        ...(this.top ? [this.top] : []),
        ...this.ed.getSources(value),
      ]),
      alternateUrls: this.ed.getAlts(value),
      tags: removeTag(getMailbox(this.store.account.tag, this.store.account.origin), uniq([
        ...this.publicTag,
        this.store.account.localTag,
        ...this.tags!,
        ...this.plugins,
        ...getTags(value),
        ...getMailboxes(value, this.store.account.origin),
      ])),
      published: moment(),
    };
    this.refs.create(ref).pipe(
      tap(() => {
        if (this.admin.status.plugins.voteUp) {
          this.ts.createResponse('plugin/vote/up', url).subscribe();
        }
      }),
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        this.comment.setValue(value);
        return throwError(() => err);
      }),
    ).subscribe(() => {
      this.serverError = [];
      this.newComments$?.next({
        ...ref,
        metadata: {
          plugins: {
            'plugin/vote/up': 1
          }
        }
      });
    });
  }

  cancel() {
    this.newComments$?.next(null);
    this.comment.setValue('');
  }
}
