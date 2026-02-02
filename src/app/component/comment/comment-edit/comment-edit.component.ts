import { HttpErrorResponse } from '@angular/common/http';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
  Input,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { FormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { uniq, without } from 'lodash-es';
import { catchError, forkJoin, map, of, Subject, Subscription, switchMap, takeUntil, throwError } from 'rxjs';
import { EditorComponent } from '../../../form/editor/editor.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Ref } from '../../../model/ref';
import { RefService } from '../../../service/api/ref.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { Store } from '../../../store/store';
import { getIfNew, getMailboxes } from '../../../util/editor';
import { printError } from '../../../util/http';
import { OpPatch } from '../../../util/json-patch';
import { getVisibilityTags } from '../../../util/tag';
import { LoadingComponent } from '../../loading/loading.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-comment-edit',
  templateUrl: './comment-edit.component.html',
  styleUrls: ['./comment-edit.component.scss'],
  host: { 'class': 'comment-edit' },
  imports: [
    forwardRef(() => EditorComponent),
    LoadingComponent,
  ]
})
export class CommentEditComponent implements AfterViewInit, HasChanges, OnDestroy {
  private store = inject(Store);
  private refs = inject(RefService);
  private ts = inject(TaggingService);
  private fb = inject(FormBuilder);

  private destroy$ = new Subject<void>();

  serverError: string[] = [];

  @Input()
  ref!: Ref;
  @Input()
  commentEdited$!: Subject<Ref>;

  @ViewChild('editor')
  editor?: EditorComponent;

  editing?: Subscription;
  commentForm: UntypedFormGroup;
  editorTags: string[] = [];
  sources: string[] = [];
  completedUploads: Ref[] = [];

  constructor() {
    const fb = this.fb;

    this.commentForm = fb.group({
      comment: [''],
    });
  }

  saveChanges() {
    return !this.commentForm.dirty;
  }

  ngAfterViewInit() {
    this.comment.setValue(this.ref.comment);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get comment() {
    return this.commentForm.get('comment') as UntypedFormControl;
  }

  get newTags() {
    return getIfNew(uniq([
      ...this.editorTags,
      ...getMailboxes(this.comment.value, this.store.account.origin),
    ]), this.ref.tags);
  }

  get allTags() {
    return uniq([
      ...this.editorTags,
      ...getMailboxes(this.comment.value, this.store.account.origin),
    ]);
  }

  save() {
    const patches: OpPatch[] = [];
    if (this.comment.dirty) {
      patches.push({
        op: 'add',
        path: '/comment',
        value: this.comment.value,
      });
    }
    const finalTags = this.allTags;
    for (const t of without(finalTags, ...this.ref.tags || [])) {
      patches.push({
        op: 'add',
        path: '/tags/-',
        value: t,
      });
    }
    for (const t of without(this.ref.tags || [], ...finalTags)) {
      patches.push({
        op: 'remove',
        path: '/tags/' + this.ref.tags!.indexOf(t),
      });
    }
    for (const s of this.sources) {
      patches.push({
        op: 'add',
        path: '/sources/-',
        value: s,
      });
    }
    this.editing = this.refs.patch(this.ref.url, this.ref.origin!, this.ref!.modifiedString!, patches).pipe(
      switchMap(() => this.refs.get(this.ref.url, this.ref.origin!).pipe(takeUntil(this.destroy$))),
      switchMap(res => {
        const finalVisibilityTags = getVisibilityTags(finalTags);
        if (!finalVisibilityTags.length) return of(res);
        const taggingOps = this.completedUploads
          .map(upload => this.ts.patch(finalVisibilityTags, upload.url, upload.origin));
        if (!taggingOps.length) return of(res);
        return forkJoin(taggingOps).pipe(map(() => res));
      }),
      catchError((res: HttpErrorResponse) => {
        delete this.editing;
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(res => {
      delete this.editing;
      this.ref = res;
      this.completedUploads = [];

      this.commentEdited$.next(res);
    });
  }

  cancel() {
    this.editing?.unsubscribe();
    this.commentEdited$.next(this.ref);
  }
}
