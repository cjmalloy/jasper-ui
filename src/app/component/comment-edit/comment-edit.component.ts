import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import * as _ from 'lodash';
import { catchError, Subject, throwError } from 'rxjs';
import { Ref } from '../../model/ref';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { getAlts, getIfNew, getNotifications, getSources, getTags } from '../../util/editor';
import { printError } from '../../util/http';

@Component({
  selector: 'app-comment-edit',
  templateUrl: './comment-edit.component.html',
  styleUrls: ['./comment-edit.component.scss'],
})
export class CommentEditComponent implements OnInit, AfterViewInit {
  @HostBinding('class') css = 'comment-edit';

  editValue = '';
  serverError: string[] = [];

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

  get plugins() {
    let result = [];
    if (this.emoji) result.push('plugin/emoji');
    if (this.latex) result.push('plugin/latex');
    return result;
  }

  get patchTags() {
    return getIfNew([
      ...getTags(this.editValue),
      ...getNotifications(this.editValue),
      ...this.plugins],
      this.ref.tags);
  }

  get patchSources() {
    return getIfNew(
      getSources(this.editValue),
      this.ref.sources);
  }

  get patchAlts() {
    return getIfNew(getAlts(this.editValue),
      this.ref.alternateUrls);
  }

  save() {
    const patches: any[] = [{
      op: 'add',
      path: '/comment',
      value: this.editValue,
    }];
    const tags = this.patchTags;
    if (tags) {
      patches.push({
        op: 'add',
        path: '/tags',
        value: tags,
      });
    }
    const sources = this.patchSources;
    if (sources) {
      patches.push({
        op: 'add',
        path: '/sources',
        value: sources,
      });
    }
    const alts = this.patchAlts;
    if (alts) {
      patches.push({
        op: 'add',
        path: '/alternateUrls',
        value: alts,
      });
    }
    this.refs.patch(this.ref.url, this.ref.origin!, patches).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      if (tags) {
        this.ref.tags = tags;
        this.emoji = tags.includes('plugin/emoji');
        this.latex = tags.includes('plugin/latex');
      }
      if (sources) {
        this.ref.sources = sources;
      }
      if (alts) {
        this.ref.alternateUrls = alts;
      }
      this.ref.comment = this.editValue;
      this.commentEdited$.next();
    });
  }

  cancel() {
    this.commentEdited$.next();
  }
}
