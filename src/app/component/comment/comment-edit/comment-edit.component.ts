import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, HostBinding, Input } from '@angular/core';
import { FormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { difference, uniq } from 'lodash-es';
import { catchError, Subject, Subscription, switchMap, throwError } from 'rxjs';
import { Ref } from '../../../model/ref';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { EditorService } from '../../../service/editor.service';
import { Store } from '../../../store/store';
import { getIfNew, getMailboxes, getTags } from '../../../util/editor';
import { printError } from '../../../util/http';

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

  editing?: Subscription;
  commentForm: UntypedFormGroup;
  editorTags: string[] = [];

  constructor(
    private admin: AdminService,
    private store: Store,
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
      ...this.ref.tags || [],
      ...getTags(this.comment.value),
      ...getMailboxes(this.comment.value, this.store.account.origin),
      ...this.editorTags],
      this.ref.tags);
  }

  get patchSources() {
    return getIfNew(
      uniq(difference(this.editor.getSources(this.comment.value), this.ref.sources || [])),
      this.ref.sources);
  }

  get patchAlts() {
    return getIfNew(
      uniq(difference(this.editor.getAlts(this.comment.value), this.ref.alternateUrls || [])),
      this.ref.alternateUrls);
  }

  save() {
    const patches: any[] = [{
      op: 'add',
      path: '/comment',
      value: this.comment.value,
    }];
    for (const t of this.patchTags) {
      patches.push({
        op: 'add',
        path: '/tags/-',
        value: t,
      });
    }
    for (const s of this.patchSources) {
      patches.push({
        op: 'add',
        path: '/sources/-',
        value: s,
      });
    }
    for (const alt of this.patchAlts) {
      patches.push({
        op: 'add',
        path: '/alternateUrls/-',
        value: alt,
      });
    }
    this.editing = this.refs.patch(this.ref.url, this.ref.origin!, this.ref!.modifiedString!, patches).pipe(
      switchMap(() => this.refs.get(this.ref.url, this.ref.origin!)),
      catchError((res: HttpErrorResponse) => {
        delete this.editing;
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(res => {
      delete this.editing;
      this.ref = res;
      this.commentEdited$.next(res);
    });
  }

  cancel() {
    this.editing?.unsubscribe();
    this.commentEdited$.next(this.ref);
  }
}
