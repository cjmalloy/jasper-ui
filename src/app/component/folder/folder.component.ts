import { CdkDrag } from '@angular/cdk/drag-drop';
import { Component, computed, effect, ElementRef, inject, input, linkedSignal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { mapValues } from 'lodash-es';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
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
  imports: [
    FileComponent,
    SubfolderComponent,
    CdkDrag,
  ],
})
export class FolderComponent implements HasChanges {
  private store = inject(Store);
  private router = inject(Router);
  private exts = inject(ExtService);
  private el = inject<ElementRef<HTMLElement>>(ElementRef);


  readonly tag = input<string>();
  readonly ext = input<Ext | undefined>(undefined);
  readonly page = input<Page<Ref> | undefined>(undefined);
  readonly pinned = input<Ref[] | null>();
  readonly emptyMessage = input('');

  error: any;

  readonly parent = toSignal(toObservable(this.tag).pipe(
    switchMap(tag => tag?.includes('/') ? this.exts.getCachedExt(tag.substring(0, tag.lastIndexOf('/')), tagOrigin(tag) || '@').pipe(
      startWith(undefined),
    ) : of(undefined)),
  ), { initialValue: undefined });
  readonly flatten = computed(() => !!this.ext()?.config?.flatten);
  readonly files = computed(() => mapValues(this.ext()?.config?.files || {}, p => this.transform(p)));
  readonly subfolders = computed(() => {
    const ext = this.ext();
    if (!ext) return {};
    return Object.fromEntries(Object.entries<Pos>(ext.config?.subfolders || {})
      .map(([tag, position]) => [ext.tag + (tag !== '..' ? '/' + tag : ''), this.transform(position)]));
  });
  readonly folderExts = toSignal(toObservable(computed(() => ({
    tag: this.tag(), origin: this.ext()?.origin || '@',
  }))).pipe(switchMap(({ tag, origin }) => tag ? this.exts.page({
    query: defaultOrigin(tag, origin), level: level(tag) + 1, size: 100,
  }).pipe(map(page => page.content), catchError(() => of(undefined)), startWith(undefined)) : of(undefined))),
  { initialValue: undefined });
  readonly cursor = linkedSignal(() => this.ext()?.modifiedString || '');
  readonly dragging = signal(false);
  zIndex = 1;








  // TODO: handle resize moving relatively positioned moved tiles

  constructor() {
    effect(() => {
      const page = this.page();
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


  readonly local = computed(() => {
    return this.ext()?.origin === this.store.account.origin();
  });


  startMoving(target: HTMLElement) {
    target.style.zIndex = ""+(this.zIndex++);
    this.dragging.set(true);
  }

  moveFile(url: string, target: HTMLElement) {
    this.dragging.set(false);
    if (!this.cursor()) return; // Wait for last move to complete
    if (!this.local()) return;
    const cursor = this.cursor();
    this.cursor.set('');
    const pos = {
      x: Math.floor(target.getBoundingClientRect().x + window.scrollX - this.el.nativeElement.offsetLeft),
      y: Math.floor(target.getBoundingClientRect().y + window.scrollY - this.el.nativeElement.offsetTop),
    };
    this.exts.patch(this.ext()!.tag + this.store.account.origin(), cursor, [{
      op: 'add',
      path: '/config/files/' + escapePath(url),
      value: pos,
    }]).subscribe(cursor => this.cursor.set(cursor));
  }

  moveFolder(tag: string, target: HTMLElement) {
    // TODO: write patches to websocket
    this.dragging.set(false);
    if (!this.cursor()) return; // Wait for last move to complete
    if (!this.local()) return;
    const cursor = this.cursor();
    this.cursor.set('');
    this.exts.patch(this.ext()!.tag + this.store.account.origin(), cursor, [{
      op: 'add',
      path: '/config/subfolders/' + (tag === this.tag() ? '..' : escapePath(tag.substring(this.ext()!.tag.length + 1))),
      value: {
        x: Math.floor(target.getBoundingClientRect().x + window.scrollX - this.el.nativeElement.offsetLeft),
        y: Math.floor(target.getBoundingClientRect().y + window.scrollY - this.el.nativeElement.offsetTop),
      },
    }]).subscribe(cursor => this.cursor.set(cursor));
  }

  inSubfolder(ref: Ref) {
    return ref.tags?.find(t => t.startsWith(this.ext()!.tag + '/'));
  }

  transform(p: Pos) {
    if (!p) return undefined;
    return 'translate3d(' + (p.x || 0) + 'px, ' + (p.y || 0) + 'px, 0)';
  }
}
