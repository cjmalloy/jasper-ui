import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input } from '@angular/core';
import { filter, without } from 'lodash-es';
import { catchError, Subject, switchMap, throwError } from 'rxjs';
import { Ref } from '../../model/ref';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { EditorService } from '../../service/editor.service';
import { Store } from '../../store/store';
import { getIfNew, getMailboxes, getTags } from '../../util/editor';
import { printError } from '../../util/http';

@Component({
  selector: 'app-comment-edit',
  templateUrl: './comment-edit.component.html',
  styleUrls: ['./comment-edit.component.scss'],
})
export class CommentEditComponent {
  @HostBinding('class') css = 'comment-edit';

  editValue = '';
  serverError: string[] = [];

  @Input()
  ref!: Ref;
  @Input()
  commentEdited$!: Subject<Ref>;

  plugins: string[] = [];

  constructor(
    private admin: AdminService,
    private account: AccountService,
    private editor: EditorService,
    private refs: RefService,
  ) { }

  get patchTags() {
    return getIfNew([
      ...this.admin.removeEditors(this.ref.tags),
      ...getTags(this.editValue),
      ...getMailboxes(this.editValue),
      ...this.plugins],
      this.ref.tags);
  }

  get patchSources() {
    return getIfNew(
      this.editor.getSources(this.editValue),
      this.ref.sources);
  }

  get patchAlts() {
    return getIfNew(this.editor.getAlts(this.editValue),
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
      switchMap(() => this.refs.get(this.ref.url, this.ref.origin!)),
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(res => {
      this.ref = res;
      this.commentEdited$.next(res);
    });
  }

  cancel() {
    this.commentEdited$.next(this.ref);
  }
}
