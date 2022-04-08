import { AfterViewInit, Component, ElementRef, HostBinding, Input, ViewChild } from '@angular/core';
import * as moment from 'moment';
import { mergeMap, Subject } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { Ref } from '../../model/ref';
import { AccountService } from '../../service/account.service';
import { RefService } from '../../service/api/ref.service';

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
  tags?: string[] | null = [];
  @Input()
  newComments$!: Subject<Ref | null>;
  @Input()
  showCancel = false;

  @ViewChild('textbox')
  textbox!: ElementRef;

  constructor(
    private account: AccountService,
    private refs: RefService,
  ) { }

  ngAfterViewInit(): void {
    this.textbox.nativeElement.focus();
  }

  reply(value: string) {
    if (!value) return;
    const url = 'comment://' + uuid();
    this.refs.create({
      url,
      sources: this.sources,
      title: 'Reply to: ' + this.top.title,
      comment: value,
      tags: ['public', 'internal', 'plugin/comment', this.account.tag, ...this.tags!],
      plugins: {
        'plugin/comment': {},
      },
      published: moment(),
    }).pipe(
      mergeMap(() => this.refs.get(url)),
    ).subscribe(ref => {
      this.newComments$.next(ref);
      this.textbox.nativeElement.value = '';
    });
  }

  cancel() {
    this.newComments$.next(null);
    this.textbox.nativeElement.value = '';
  }
}
