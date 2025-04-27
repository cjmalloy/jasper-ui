import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { FormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { pickBy, uniq } from 'lodash-es';
import { DateTime } from 'luxon';
import { catchError, Subscription, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { EditorComponent } from '../../../form/editor/editor.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Ref } from '../../../model/ref';
import { commentPlugin } from '../../../mods/comment';
import { getMailbox } from '../../../mods/mailbox';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { Store } from '../../../store/store';
import { getMailboxes } from '../../../util/editor';
import { getRe } from '../../../util/format';
import { printError } from '../../../util/http';
import { hasTag, removeTag } from '../../../util/tag';

@Component({
  standalone: false,
  selector: 'app-comment-reply',
  templateUrl: './comment-reply.component.html',
  styleUrls: ['./comment-reply.component.scss'],
  host: {'class': 'comment-reply'}
})
export class CommentReplyComponent implements HasChanges {

  @Input()
  to!: Ref;
  @Input()
  selectResponseType = false;
  @Input()
  tags: string[] = [];
  @Input()
  showCancel = false;
  @Input()
  autofocus = false;
  @Output()
  save = new EventEmitter<Ref|undefined>();

  @ViewChild(EditorComponent)
  editor?: EditorComponent

  editorTags: string[] = [];

  replying?: Subscription;
  commentForm: UntypedFormGroup;
  serverError: string[] = [];
  config = this.admin.getPlugin('plugin/comment')?.config || commentPlugin.config!;

  constructor(
    public admin: AdminService,
    public store: Store,
    private refs: RefService,
    private ts: TaggingService,
    private fb: FormBuilder,
  ) {
    this.commentForm = fb.group({
      comment: [''],
    });
  }

  saveChanges(): boolean {
    return !this.commentForm.dirty;
  }

  get comment() {
    return this.commentForm.get('comment') as UntypedFormControl;
  }

  get inheritedPlugins() {
    const plugins = this.admin.getPlugins(this.to.tags)
      .filter(p => p.config?.inherit)
      .map(p => p.tag);
    return pickBy(this.to.plugins, (data, tag) => hasTag(tag, plugins));
  }

  reply() {
    if (!this.comment.value) return;
    const url = 'comment:' + uuid();
    const value = this.comment.value;
    const inheritedPlugins = this.inheritedPlugins;
    const tags = removeTag(getMailbox(this.store.account.tag, this.store.account.origin), uniq([
      ...(this.store.account.localTag ? [this.store.account.localTag] : []),
      ...this.editorTags,
      ...getMailboxes(value, this.store.account.origin),
      ...Object.keys(inheritedPlugins),
    ]));
    const sources = [this.to.url];
    if (hasTag('plugin/comment', tags) || hasTag('plugin/thread', tags)) {
      if (hasTag('plugin/comment', this.to) || hasTag('plugin/thread', this.to)) {
        // Parent may be the top
        sources.push(this.to.sources?.[1] || this.to.url);
      } else {
        // Parent is the top
        sources.push(this.to.url);
      }
    }
    const ref: Ref = {
      url,
      origin: this.store.account.origin,
      title: (hasTag('plugin/email', this.to) || hasTag('plugin/thread', this.to)) ? getRe(this.to.title) : '',
      comment: value,
      sources,
      tags,
      plugins: inheritedPlugins,
      published: DateTime.now(),
    };
    this.comment.disable();
    this.replying = this.refs.create(ref).pipe(
      tap(cursor => {
        ref.modifiedString = cursor;
        ref.modified = DateTime.fromISO(cursor);
        if (this.admin.getPlugin('plugin/user/vote/up')) {
          this.ts.createResponse('plugin/user/vote/up', url).subscribe();
        }
      }),
      catchError((err: HttpErrorResponse) => {
        delete this.replying;
        this.serverError = printError(err);
        this.comment.enable();
        return throwError(() => err);
      }),
    ).subscribe(() => {
      delete this.replying;
      this.serverError = [];
      this.comment.enable();
      this.commentForm.reset();
      this.editor?.syncText('');
      const update = {
        ...ref,
        created: DateTime.now(),
        metadata: {
          plugins: {
            'plugin/user/vote/up': 1
          }
        }
      };
      this.save.emit(update);
    });
  }

  cancel() {
    this.replying?.unsubscribe();
    this.commentForm.reset();
    this.save.emit(undefined);
  }
}
