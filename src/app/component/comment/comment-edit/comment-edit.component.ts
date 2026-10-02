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

  private readonly serverErrorSignal = signal<string[]>([]);

  readonly refInput = input.required<Ref>({ alias: 'ref' });
  private readonly refSignal = linkedSignal(() => this.refInput());
  get ref() { return this.refSignal(); }
  set ref(value: Ref) { this.refSignal.set(value); }
  readonly commentEdited$ = input.required<Subject<Ref>>();

  readonly editor = viewChild<EditorComponent>('editor');

  private readonly editingSignal = signal<Subscription | undefined>(undefined);
  commentForm: UntypedFormGroup;
  private readonly editorTagsSignal = signal<string[]>([]);
  private readonly sourcesSignal = signal<string[]>([]);
  private readonly completedUploadsSignal = signal<Ref[]>([]);

  get serverError() { return this.serverErrorSignal(); }
  set serverError(value: string[]) { this.serverErrorSignal.set(value); }
  get editing() { return this.editingSignal(); }
  set editing(value: Subscription | undefined) { this.editingSignal.set(value); }
  get editorTags() { return this.editorTagsSignal(); }
  set editorTags(value: string[]) { this.editorTagsSignal.set(value); }
  get sources() { return this.sourcesSignal(); }
  set sources(value: string[]) { this.sourcesSignal.set(value); }
  get completedUploads() { return this.completedUploadsSignal(); }
  set completedUploads(value: Ref[]) { this.completedUploadsSignal.set(value); }

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
    this.comment.setValue(this.ref.comment);
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

  get top() {
    return this.ref.sources?.[1] || this.ref.sources?.[0] || this.ref.url;
  }

  addSource(value = '') {
    if ((this.ref.sources?.length || 0) < 1) {
      this.sources = [...this.sources, this.top];
    }
    if ((this.ref.sources?.length || 0) < 2) {
      this.sources = [...this.sources, this.top];
    }
    this.sources = [...this.sources, value];
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
    const removeIndices = (this.ref.tags || [])
      .map((t, i) => finalTags.includes(t) ? -1 : i)
      .filter(i => i >= 0)
      .sort((a, b) => b - a);
    for (const i of removeIndices) {
      patches.push({
        op: 'remove',
        path: '/tags/' + i,
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
      switchMap(() => this.refs.get(this.ref.url, this.ref.origin!).pipe(takeUntilDestroyed(this.destroyRef))),
      switchMap(res => {
        const finalVisibilityTags = getVisibilityTags(finalTags);
        if (!finalVisibilityTags.length) return of(res);
        const taggingOps = this.completedUploads
          .map(upload => this.ts.patch(finalVisibilityTags, upload.url, upload.origin));
        if (!taggingOps.length) return of(res);
        return forkJoin(taggingOps).pipe(map(() => res));
      }),
      catchError((res: HttpErrorResponse) => {
        this.editing = undefined;
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(res => {
      this.editing = undefined;
      this.ref = res;
      this.completedUploads = [];

      this.commentEdited$().next(res);
    });
  }

  cancel() {
    this.editing?.unsubscribe();
    this.commentEdited$().next(this.ref);
  }
}
