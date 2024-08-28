import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, HostBinding, Input, ViewChild } from '@angular/core';
import { FormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { defer, merge, pickBy, uniq, without } from 'lodash-es';
import * as moment from 'moment';
import { catchError, Subject, Subscription, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { EditorComponent } from '../../../form/editor/editor.component';
import { Ref } from '../../../model/ref';
import { commentPlugin } from '../../../mods/comment';
import { getMailbox } from '../../../mods/mailbox';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { Store } from '../../../store/store';
import { getMailboxes, getTags } from '../../../util/editor';
import { getRe } from '../../../util/format';
import { printError } from '../../../util/http';
import { hasTag, removeTag, tagIntersection } from '../../../util/tag';

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
  selectResponseType = false;
  @Input()
  tags: string[] = [];
  @Input()
  newResp$?: Subject<Ref|null>;
  @Input()
  newComment$?: Subject<Ref|null>;
  @Input()
  newThread$?: Subject<Ref|null>;
  @Input()
  showCancel = false;
  @Input()
  autofocus = false;

  @ViewChild(EditorComponent)
  editor?: EditorComponent;

  replying?: Subscription;
  commentForm: UntypedFormGroup;
  serverError: string[] = [];
  config = this.admin.getPlugin('plugin/comment')?.config || commentPlugin.config!;
  _quote?: string;

  private _editorTags: string[] = [];

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

  ngAfterViewInit(): void {
    this.comment.setValue(this.quote);
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

  get editorTags(): string[] {
    return this._editorTags;
  }

  set editorTags(value: string[]) {
    if (this.tags) {
      const added = without(value, ...this._editorTags);
      const removed = without(this._editorTags, ...value);
      this.tags = uniq([...without(this.tags, ...removed), ...added]);
      this._editorTags = value;
    } else {
      defer(() => this.editorTags = value);
    }
  }

  get inheritedPlugins() {
    const plugins = this.admin.getPlugins(this.to.tags)
      .filter(p => p.tag === p.config?.signature && tagIntersection(this.tags, p.config?.reply).length)
      .map(p => p.tag);
    const parentPlugins = pickBy(this.to.plugins, (data, tag) => plugins.includes(tag));
    return merge({}, ...Object.keys(parentPlugins)
      .flatMap(tag => (this.admin.getPlugin(tag)?.config?.reply || [])
        .filter(r => this.tags.includes(r))
        .map(r => ({ [r]: this.admin.stripInvalid(r, parentPlugins[tag]) }))));
  }

  reply() {
    if (!this.comment.value) return;
    const url = 'comment:' + uuid();
    const value = this.comment.value;
    const ref: Ref = {
      url,
      origin: this.store.account.origin,
      title: (hasTag('plugin/email', this.to) || hasTag('plugin/thread', this.to)) ? getRe(this.to.title) : '',
      comment: value,
      sources: [
        this.to.url,
        ...[this.to.sources?.[1] || this.to.sources?.[0] || this.to.url],
      ],
      tags: removeTag(getMailbox(this.store.account.tag, this.store.account.origin), uniq([
        ...this.publicTag,
        ...(this.store.account.localTag ? [this.store.account.localTag] : []),
        ...this.tags!,
        ...this.editorTags,
        ...getTags(value),
        ...getMailboxes(value, this.store.account.origin),
      ])),
      plugins: this.inheritedPlugins,
      published: moment(),
    };
    this.comment.disable();
    this.replying = this.refs.create(ref).pipe(
      tap(cursor => {
        ref.modifiedString = cursor;
        ref.modified = moment(cursor);
        if (this.admin.getPlugin('plugin/vote/up')) {
          this.ts.createResponse('plugin/vote/up', url).subscribe();
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
      this.comment.setValue('');
      this.editor?.syncText('');
      const update = {
        ...ref,
        created: moment(),
        metadata: {
          plugins: {
            'plugin/vote/up': 1
          }
        }
      };
      if (hasTag('plugin/comment', ref)) {
        this.newComment$?.next(update);
      } else if (hasTag('plugin/thread', ref)) {
        this.newThread$?.next(update);
      } else if (!hasTag('internal', ref)) {
        this.newResp$?.next(update);
      }
    });
  }

  cancel() {
    this.replying?.unsubscribe();
    this.newResp$?.next(null);
    this.newComment$?.next(null);
    this.newThread$?.next(null);
    this.comment.setValue('');
  }
}
