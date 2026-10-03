import {
  HttpErrorResponse
} from '@angular/common/http';
import { DestroyRef, inject, Component, computed, effect, forwardRef, ChangeDetectionStrategy, input, linkedSignal, viewChild, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { uniq, without } from 'lodash-es';
import { catchError, finalize, forkJoin, map, of, Subject, Subscription, switchMap } from 'rxjs';
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
export class CommentEditComponent implements HasChanges {
  private destroyRef = inject(DestroyRef);

  readonly serverError = signal<string[]>([]);

  readonly refInput = input.required<Ref>({ alias: 'ref' });
  readonly ref = linkedSignal(() => this.refInput());
  readonly commentEdited$ = input.required<Subject<Ref>>();

  readonly editor = viewChild<EditorComponent>('editor');

  readonly editing = signal(false);
  private editingSubscription?: Subscription;
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
    this.commentValue = toSignal(this.comment().valueChanges, { initialValue: this.comment().value });
    effect(() => this.comment().setValue(this.ref().comment));
  }

  saveChanges() {
    return !this.commentForm.dirty;
  }

  readonly commentValue;
  readonly comment = computed(() => {
    return this.commentForm.get('comment') as UntypedFormControl;
  });

  readonly newTags = computed(() => {
    return getIfNew(uniq([
      ...this.editorTags(),
      ...getMailboxes(this.commentValue(), this.store.account.origin()),
    ]), this.ref().tags);
  });

  readonly allTags = computed(() => {
    return uniq([
      ...this.editorTags(),
      ...getMailboxes(this.commentValue(), this.store.account.origin()),
    ]);
  });

  readonly top = computed(() => {
    return this.ref().sources?.[1] || this.ref().sources?.[0] || this.ref().url;
  });

  addSource(value = '') {
    const missing = Math.max(0, 2 - ((this.ref().sources?.length || 0) + this.sources().length));
    this.sources.update(sources => [...sources, ...Array<string>(missing).fill(this.top()), value]);
  }

  uploadCompleted(ref: Ref) {
    this.completedUploads.update(uploads => [...uploads, ref]);
  }

  save() {
    if (this.editing()) return;
    const patches: OpPatch[] = [];
    if (this.comment().dirty) {
      patches.push({
        op: 'add',
        path: '/comment',
        value: this.comment().value,
      });
    }
    const finalTags = this.allTags();
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
    this.editing.set(true);
    this.editingSubscription = this.refs.patch(this.ref().url, this.ref().origin!, this.ref().modifiedString!, patches).pipe(
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
        this.serverError.set(printError(res));
        return of(undefined);
      }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.editing.set(false)),
    ).subscribe(res => {
      if (!res) return;
      this.ref.set(res);
      this.completedUploads.set([]);

      this.commentEdited$().next(res);
    });
  }

  cancel() {
    this.editingSubscription?.unsubscribe();
    this.commentEdited$().next(this.ref());
  }
}
