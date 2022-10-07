import { AfterViewInit, Component, ElementRef, HostBinding, Input, ViewChild } from '@angular/core';
import * as _ from 'lodash-es';
import * as moment from 'moment';
import { Subject, switchMap } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { Ref } from '../../model/ref';
import { getMailbox } from '../../plugin/mailbox';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { EditorService } from '../../service/editor.service';
import { Store } from '../../store/store';
import { getMailboxes, getTags } from '../../util/editor';
import { hasTag, removeTag } from '../../util/tag';

@Component({
  selector: 'app-comment-reply',
  templateUrl: './comment-reply.component.html',
  styleUrls: ['./comment-reply.component.scss'],
})
export class CommentReplyComponent implements AfterViewInit {
  @HostBinding('class') css = 'comment-reply';

  @Input()
  top!: Ref;
  @Input()
  sources!: string[];
  @Input()
  tags: string[] = [];
  @Input()
  newComments$!: Subject<Ref | null>;
  @Input()
  showCancel = false;
  @Input()
  autofocus = false;

  @ViewChild('textbox')
  textbox!: ElementRef;

  emoji = this.admin.status.plugins.emoji;
  latex = this.admin.status.plugins.latex;
  textboxValue = '';

  constructor(
    public admin: AdminService,
    private store: Store,
    private editor: EditorService,
    private refs: RefService,
  ) { }

  get publicTag() {
    if (!hasTag('public', this.top)) return [];
    return ['public'];
  }

  get plugins() {
    const result = [];
    if (this.emoji) result.push('plugin/emoji');
    if (this.latex) result.push('plugin/latex');
    return result;
  }

  ngAfterViewInit(): void {
    if (this.autofocus) {
      this.textbox.nativeElement.focus();
    }
  }

  reply(value: string) {
    if (!value) return;
    const url = 'comment:' + uuid();
    this.refs.create({
      url,
      origin: this.store.account.origin,
      title: 'Reply to: ' + this.top.title,
      comment: value,
      sources: _.uniq([
        ...this.sources,
        ...this.editor.getSources(value),
      ]),
      alternateUrls: this.editor.getAlts(value),
      tags: removeTag(getMailbox(this.store.account.tag), _.uniq([
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
    ).subscribe(ref => {
      this.newComments$.next(ref);
      this.textbox.nativeElement.value = this.textboxValue = '';
    });
  }

  cancel() {
    this.newComments$.next(null);
    this.textbox.nativeElement.value = this.textboxValue = '';
  }
}
