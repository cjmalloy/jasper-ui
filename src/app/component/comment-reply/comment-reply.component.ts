import { AfterViewInit, Component, ElementRef, HostBinding, Input, ViewChild } from '@angular/core';
import * as _ from 'lodash';
import * as moment from 'moment';
import { Subject, switchMap } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { Ref } from '../../model/ref';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { EditorService } from '../../service/editor.service';
import { getNotifications, getTags } from '../../util/editor';

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
    private account: AccountService,
    private editor: EditorService,
    private refs: RefService,
  ) { }

  get publicTag() {
    if (!this.top.tags?.includes('public')) return [];
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
      title: 'Reply to: ' + this.top.title,
      comment: value,
      sources: _.uniq([
        ...this.sources,
        ...this.editor.getSources(value),
      ]),
      alternateUrls: this.editor.getAlts(value),
      tags: _.uniq([
        ...this.publicTag,
        'internal',
        'plugin/comment',
        this.account.tag,
        ...this.tags!,
        ...this.plugins,
        ...getTags(value),
        ...getNotifications(value),
      ]),
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
