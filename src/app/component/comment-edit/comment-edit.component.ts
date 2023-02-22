import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, HostBinding, Input } from '@angular/core';
import { FormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { without } from 'lodash-es';
import { catchError, Subject, switchMap, throwError } from 'rxjs';
import { Ref } from '../../model/ref';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { EditorService } from '../../service/editor.service';
import { getIfNew, getMailboxes, getTags } from '../../util/editor';
import { printError } from '../../util/http';

@Component({
  selector: 'app-comment-edit',
  templateUrl: './comment-edit.component.html',
  styleUrls: ['./comment-edit.component.scss'],
})
export class CommentEditComponent implements AfterViewInit {
  @HostBinding('class') css = 'comment-edit';

  serverError: string[] = [];

  @Input()
  ref!: Ref;
  @Input()
  commentEdited$!: Subject<Ref>;

  commentForm: UntypedFormGroup;
  plugins: string[] = [];

  constructor(
    private admin: AdminService,
    private account: AccountService,
    private editor: EditorService,
    private refs: RefService,
    private fb: FormBuilder,
  ) {
    this.commentForm = fb.group({
      comment: [''],
    });
  }

  ngAfterViewInit() {
    this.comment.setValue(this.ref.comment);
  }

  get comment() {
    return this.commentForm.get('comment') as UntypedFormControl;
  }

  get patchTags() {
    return getIfNew([
      ...without(this.ref.tags, ...this.admin.editorTags),
      ...getTags(this.comment.value),
      ...getMailboxes(this.comment.value),
      ...this.plugins],
      this.ref.tags);
  }

  get patchSources() {
    return getIfNew(
      this.editor.getSources(this.comment.value),
      this.ref.sources);
  }

  get patchAlts() {
    return getIfNew(this.editor.getAlts(this.comment.value),
      this.ref.alternateUrls);
  }

  save() {
    const patches: any[] = [{
      op: 'add',
      path: '/comment',
      value: this.comment.value,
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
