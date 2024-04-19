import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, HostBinding, Input, ViewChild } from '@angular/core';
import { FormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { uniq } from 'lodash-es';
import * as moment from 'moment';
import { catchError, Subject, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { EditorComponent } from '../../../form/editor/editor.component';
import { Ref } from '../../../model/ref';
import { commentPlugin } from '../../../mods/comment';
import { getMailbox } from '../../../mods/mailbox';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { EditorService } from '../../../service/editor.service';
import { Store } from '../../../store/store';
import { ThreadStore } from '../../../store/thread';
import { getMailboxes, getTags } from '../../../util/editor';
import { authors, getRe } from '../../../util/format';
import { printError } from '../../../util/http';
import { hasTag, removeTag, setPublic } from '../../../util/tag';

@Component({
  selector: 'app-comment-reply',
  templateUrl: './comment-reply.component.html',
  styleUrls: ['./comment-reply.component.scss'],
})
export class CommentReplyComponent implements AfterViewInit {
  @HostBinding('class') css = 'comment-reply';

  @Input()
  to!: Ref;
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
  editorTags: string[] = [];
  serverError: string[] = [];
  config = this.admin.getPlugin('plugin/comment')?.config || commentPlugin.config!;
  _quote?: string;

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

  get quote() {
    if (this._quote !== undefined) return this._quote;
    const q = this.to.comment || '';
    if (!q) return q;
    return q.split('\n').map(l => '> ' + l).join('\n') + '\n\n';
  }

  @Input()
  set quote(value: string) {
    this._quote = value;
  }

  ngAfterViewInit(): void {
    this.comment.setValue(this.quote);
  }

  reply() {
    if (!this.comment.value) return;
    const url = 'comment:' + uuid();
    const value = this.comment.value;
    this.comment.setValue('');
    this.editor?.syncText('');
    const myTags = [setPublic(this.store.account.tag), getMailbox(this.store.account.tag, this.store.account.origin)];
    // TODO: support plugin/from
    const replyTags = authors(this.to, ['user']).map(setPublic);
    const tags = removeTag(myTags, uniq([
      ...this.publicTag,
      ...(this.store.account.localTag ? [this.store.account.localTag] : []),
      ...this.tags!,
      ...replyTags,
      ...getTags(value),
      ...getMailboxes(value, this.store.account.origin),
    ]));
    const ref: Ref = {
      url,
      origin: this.store.account.origin,
      title: (hasTag('plugin/email', this.to) || hasTag('plugin/thread', this.to)) ? getRe(this.to.title) : '',
      comment: value,
      sources: uniq([
        this.to.url,
        ...[this.to.sources?.[1] || this.to.sources?.[0] || this.to.url],
        ...this.ed.getSources(value),
      ]),
      alternateUrls: this.ed.getAlts(value),
      tags,
      published: moment(),
    };
    this.refs.create(ref).pipe(
      tap(cursor => {
        ref.modifiedString = cursor;
        ref.modified = moment(cursor);
        if (this.admin.getPlugin('plugin/vote/up')) {
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
        created: moment(),
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
