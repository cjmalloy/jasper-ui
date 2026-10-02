import { CdkDrag } from '@angular/cdk/drag-drop';
import { Component, effect, ElementRef, ChangeDetectionStrategy, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { mapValues } from 'lodash-es';
import { catchError, of, Subscription } from 'rxjs';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Ext } from '../../model/ext';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { Pos } from '../../mods/org/folder';
import { ExtService } from '../../service/api/ext.service';
import { Store } from '../../store/store';
import { escapePath } from '../../util/json-patch';
import { defaultOrigin, level, tagOrigin } from '../../util/tag';
import { FileComponent } from './file/file.component';
import { SubfolderComponent } from './subfolder/subfolder.component';

@Component({
  selector: 'app-folder',
  templateUrl: './folder.component.html',
  styleUrls: ['./folder.component.scss'],
  host: { 'class': 'folder ext' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FileComponent,
    SubfolderComponent,
    CdkDrag,
  ],
})
export class FolderComponent implements HasChanges {

  readonly tag = input<string>();
  readonly extInput = input<Ext | undefined>(undefined, { alias: 'ext' });
  get ext() { return this.extInput(); }
  readonly pageInput = input<Page<Ref> | undefined>(undefined, { alias: 'page' });
  readonly pinned = input<Ref[] | null>();
  readonly emptyMessage = input('');

  error: any;

  private readonly parentSignal = signal<Ext | undefined>(undefined);
  private readonly flattenSignal = signal(false);
  private readonly filesSignal = signal<Record<string, string | undefined>>({});
  private readonly subfoldersSignal = signal<Record<string, string | undefined>>({});
  private readonly folderExtsSignal = signal<Ext[] | undefined>(undefined);
  private readonly cursorSignal = signal('');
  private readonly draggingSignal = signal(false);
  zIndex = 1;

  get parent() { return this.parentSignal(); }
  set parent(value: Ext | undefined) { this.parentSignal.set(value); }

  get flatten() { return this.flattenSignal(); }
  set flatten(value: boolean) { this.flattenSignal.set(value); }

  get files() { return this.filesSignal(); }
  set files(value: Record<string, string | undefined>) { this.filesSignal.set(value); }

  get subfolders() { return this.subfoldersSignal(); }
  set subfolders(value: Record<string, string | undefined>) { this.subfoldersSignal.set(value); }

  get folderExts() { return this.folderExtsSignal(); }
  set folderExts(value: Ext[] | undefined) { this.folderExtsSignal.set(value); }

  get cursor() { return this.cursorSignal(); }
  set cursor(value: string) { this.cursorSignal.set(value); }

  get dragging() { return this.draggingSignal(); }
  set dragging(value: boolean) { this.draggingSignal.set(value); }

  private folderSubscription?: Subscription;

  // TODO: handle resize moving relatively positioned moved tiles

  constructor(
    private store: Store,
    private router: Router,
    private exts: ExtService,
    private el: ElementRef<HTMLElement>,
  ) {
    effect(() => {
      this.tag();
      untracked(() => this.loadTag());
    });
    effect(() => {
      this.extInput();
      untracked(() => this.loadExt());
    });
    effect(() => {
      const page = this.pageInput();
      if (page && page.page.number !== undefined && page.page.number > 0 && page.page.number >= page.page.totalPages) {
        this.router.navigate([], {
          queryParams: {
            pageNumber: page.page.totalPages - 1
          },
          queryParamsHandling: "merge",
        });
      }
    });
  }

  saveChanges() {
    // TODO
    return true;
  }

  private loadTag() {
    this.folderExts = undefined;
    this.parent = undefined;
    const tag = this.tag();
    if (tag?.includes('/')) {
      this.exts.getCachedExt(tag.substring(0, tag.lastIndexOf('/')), tagOrigin(tag) || '@')
        .subscribe(ext => this.parent = ext);
    }
    this.folderSubscription?.unsubscribe();
    if (!tag) return;
    this.folderSubscription = this.exts.page({
      query: defaultOrigin(tag, (this.ext?.origin || '@')),
      level: level(tag) + 1,
      size: 100
    }).pipe(
      catchError(() => of(undefined)),
    ).subscribe(page => {
      this.folderExts = page?.content;
    });
  }

  private loadExt() {
    this.files = {};
    this.subfolders = {};
    this.flatten = this.ext?.config?.flatten;
    if (!this.ext) return;
    this.cursor = this.ext.modifiedString!;
    this.files = mapValues(this.ext.config?.files || {}, p => this.transform(p));
    for (const e of Object.entries<Pos>(this.ext.config?.subfolders || {})) {
      this.subfolders[this.ext.tag + (e[0] !== '..' ? '/' + e[0] : '')] = this.transform(e[1]);
    }
  }


  get local() {
    return this.ext?.origin === this.store.account.origin;
  }

  get page(): Page<Ref> | undefined {
    return this.pageInput();
  }

  startMoving(target: HTMLElement) {
    target.style.zIndex = ""+(this.zIndex++);
  }

  moveFile(url: string, target: HTMLElement) {
    if (!this.cursor) return; // Wait for last move to complete
    if (!this.local) return;
    const cursor = this.cursor;
    this.cursor = '';
    this.dragging = true
    const pos = {
      x: Math.floor(target.getBoundingClientRect().x + window.scrollX - this.el.nativeElement.offsetLeft),
      y: Math.floor(target.getBoundingClientRect().y + window.scrollY - this.el.nativeElement.offsetTop),
    };
    this.exts.patch(this.ext!.tag + this.store.account.origin, cursor, [{
      op: 'add',
      path: '/config/files/' + escapePath(url),
      value: pos,
    }]).subscribe(cursor => this.cursor = cursor);
  }

  moveFolder(tag: string, target: HTMLElement) {
    // TODO: write patches to websocket
    if (!this.cursor) return; // Wait for last move to complete
    if (!this.local) return;
    const cursor = this.cursor;
    this.cursor = '';
    this.dragging = true
    this.exts.patch(this.ext!.tag + this.store.account.origin, cursor, [{
      op: 'add',
      path: '/config/subfolders/' + (tag === this.tag() ? '..' : escapePath(tag.substring(this.ext!.tag.length + 1))),
      value: {
        x: Math.floor(target.getBoundingClientRect().x + window.scrollX - this.el.nativeElement.offsetLeft),
        y: Math.floor(target.getBoundingClientRect().y + window.scrollY - this.el.nativeElement.offsetTop),
      },
    }]).subscribe(cursor => this.cursor = cursor);
  }

  inSubfolder(ref: Ref) {
    return ref.tags?.find(t => t.startsWith(this.ext!.tag + '/'));
  }

  transform(p: Pos) {
    if (!p) return undefined;
    return 'translate3d(' + (p.x || 0) + 'px, ' + (p.y || 0) + 'px, 0)';
  }
}
