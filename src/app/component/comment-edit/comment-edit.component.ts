import { AfterViewInit, Component, ElementRef, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import * as _ from 'lodash';
import { Subject } from 'rxjs';
import { Ref } from '../../model/ref';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';

@Component({
  selector: 'app-comment-edit',
  templateUrl: './comment-edit.component.html',
  styleUrls: ['./comment-edit.component.scss'],
})
export class CommentEditComponent implements OnInit, AfterViewInit {
  @HostBinding('class') css = 'comment-edit';

  editValue = '';

  @Input()
  ref!: Ref;
  @Input()
  commentEdited$!: Subject<void>;
  @ViewChild('textbox')
  textbox!: ElementRef;

  emoji = !!this.admin.status.plugins.emoji;
  latex = !!this.admin.status.plugins.latex;

  constructor(
    public admin: AdminService,
    private account: AccountService,
    private refs: RefService,
  ) { }

  ngOnInit(): void {
    this.editValue = this.ref.comment || '';
    this.emoji &&= this.ref.tags?.includes('plugin/emoji') || false;
    this.latex &&= this.ref.tags?.includes('plugin/latex') || false;
  }

  ngAfterViewInit(): void {
    this.textbox.nativeElement.focus();
  }

  get patchPluginTags() {
    const hadEmoji = this.ref.tags?.includes('plugin/emoji') || false;
    const hadLatex = this.ref.tags?.includes('plugin/latex') || false;
    if (this.emoji === hadEmoji && this.latex === hadLatex) return null;
    let tags = [...(this.ref.tags || [])];
    if (!this.emoji) {
      tags = _.without(tags, 'plugin/emoji');
    } else if (!tags.includes('plugin/emoji')) {
      tags.push('plugin/emoji');
    }
    if (!this.latex) {
      tags = _.without(tags, 'plugin/latex');
    } else if (!tags.includes('plugin/latex')) {
      tags.push('plugin/latex');
    }
    return tags;
  }

  save() {
    const patches: any[] = [{
      op: 'add',
      path: '/comment',
      value: this.editValue,
    }];
    const tags = this.patchPluginTags;
    if (tags) {
      patches.push({
        op: 'add',
        path: '/tags',
        value: tags,
      });
    }
    this.refs.patch(this.ref.url, this.ref.origin!, patches).subscribe(() => {
      if (tags) {
        this.ref.tags = tags;
        this.emoji = tags.includes('plugin/emoji');
        this.latex = tags.includes('plugin/latex');
      }
      this.ref.comment = this.editValue;
      this.commentEdited$.next();
    });
  }

  cancel() {
    this.commentEdited$.next();
  }
}
