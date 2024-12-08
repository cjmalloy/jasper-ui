import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, HostBinding, Input } from '@angular/core';
import { FormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { uniq, without } from 'lodash-es';
import { catchError, Subject, Subscription, switchMap, throwError } from 'rxjs';
import { Ref } from '../../../model/ref';
import { RefService } from '../../../service/api/ref.service';
import { Store } from '../../../store/store';
import { getIfNew, getMailboxes } from '../../../util/editor';
import { printError } from '../../../util/http';

@Component({
  standalone: false,
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
    private store: Store,
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
    const addTags = this.editorTags.filter(t => !t.startsWith('-'));
    const removeTags = this.editorTags.filter(t => t.startsWith('-')).map(t => t.substring(1));
    return getIfNew(without(uniq([
      ...this.ref.tags || [],
      ...getMailboxes(this.comment.value, this.store.account.origin),
      ...addTags]), ...removeTags),
      this.ref.tags);
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
