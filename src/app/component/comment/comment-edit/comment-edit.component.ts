import {
  HttpErrorResponse
} from '@angular/common/http';
import { DestroyRef, inject, AfterViewInit, Component, forwardRef, ChangeDetectionStrategy, input, linkedSignal, viewChild, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { uniq, without } from 'lodash-es';
import { catchError, forkJoin, map, of, Subject, Subscription, switchMap, throwError } from 'rxjs';
import { EditorComponent } from '../../../form/editor/editor.component';
import { LinksFormComponent } from '../../../form/links/links.component';
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
  selector: 'app-comment-edit',
  templateUrl: './comment-edit.component.html',
  styleUrls: ['./comment-edit.component.scss'],
  host: { 'class': 'comment-edit' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    forwardRef(() => EditorComponent),
    LoadingComponent,
  ]
})
export class CommentEditComponent implements AfterViewInit, HasChanges {
  private destroyRef = inject(DestroyRef);

  readonly serverError = signal<string[]>([]);

  readonly refInput = input.required<Ref>({ alias: 'ref' });
  readonly ref = linkedSignal(() => this.refInput());
  readonly commentEdited$ = input.required<Subject<Ref>>();

  readonly editor = viewChild<EditorComponent>('editor');

  readonly editing = signal<Subscription | undefined>(undefined);
  commentForm: UntypedFormGroup;
  readonly editorTags = signal<string[]>([]);
  readonly sources = signal<string[]>([]);
  readonly completedUploads = signal<Ref[]>([]);


  constructor(
    private store: Store,
    private refs: RefService,
    private ts: TaggingService,
    private fb: FormBuilder,
  ) {
    this.commentForm = fb.group({
      comment: [''],
    });
  }

  saveChanges() {
    return !this.commentForm.dirty;
  }

  ngAfterViewInit() {
    this.comment.setValue(this.ref().comment);
  }


  get comment() {
    return this.commentForm.get('comment') as UntypedFormControl;
  }

  get newTags() {
    return getIfNew(uniq([
      ...this.editorTags(),
      ...getMailboxes(this.comment.value, this.store.account.origin()),
    ]), this.ref().tags);
  }

  get allTags() {
    return uniq([
      ...this.editorTags(),
      ...getMailboxes(this.comment.value, this.store.account.origin()),
    ]);
  }

  get top() {
    return this.ref().sources?.[1] || this.ref().sources?.[0] || this.ref().url;
  }

  addSource(value = '') {
    if ((this.ref().sources?.length || 0) < 1) {
      this.sources.set([...this.sources(), this.top]);
    }
    if ((this.ref().sources?.length || 0) < 2) {
      this.sources.set([...this.sources(), this.top]);
    }
    this.sources.set([...this.sources(), value]);
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
    for (const t of without(finalTags, ...this.ref().tags || [])) {
      patches.push({
        op: 'add',
        path: '/tags/-',
        value: t,
      });
    }
    const removeIndices = (this.ref().tags || [])
      .map((t, i) => finalTags.includes(t) ? -1 : i)
      .filter(i => i >= 0)
      .sort((a, b) => b - a);
    for (const i of removeIndices) {
      patches.push({
        op: 'remove',
        path: '/tags/' + i,
      });
    }
    for (const s of this.sources()) {
      patches.push({
        op: 'add',
        path: '/sources/-',
        value: s,
      });
    }
    this.editing.set(this.refs.patch(this.ref().url, this.ref().origin!, this.ref()!.modifiedString!, patches).pipe(
      switchMap(() => this.refs.get(this.ref().url, this.ref().origin!).pipe(takeUntilDestroyed(this.destroyRef))),
      switchMap(res => {
        const finalVisibilityTags = getVisibilityTags(finalTags);
        if (!finalVisibilityTags.length) return of(res);
        const taggingOps = this.completedUploads()
          .map(upload => this.ts.patch(finalVisibilityTags, upload.url, upload.origin));
        if (!taggingOps.length) return of(res);
        return forkJoin(taggingOps).pipe(map(() => res));
      }),
      catchError((res: HttpErrorResponse) => {
        this.editing.set(undefined);
        this.serverError.set(printError(res));
        return throwError(() => res);
      }),
    ).subscribe(res => {
      this.editing.set(undefined);
      this.ref.set(res);
      this.completedUploads.set([]);

      this.commentEdited$().next(res);
    }));
  }

  cancel() {
    this.editing()?.unsubscribe();
    this.commentEdited$().next(this.ref());
  }
}
