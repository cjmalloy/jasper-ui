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
  readonly ext = input<Ext | undefined>(undefined);
  readonly page = input<Page<Ref> | undefined>(undefined);
  readonly pinned = input<Ref[] | null>();
  readonly emptyMessage = input('');

  error: any;

  readonly parent = signal<Ext | undefined>(undefined);
  readonly flatten = signal(false);
  readonly files = signal<Record<string, string | undefined>>({});
  readonly subfolders = signal<Record<string, string | undefined>>({});
  readonly folderExts = signal<Ext[] | undefined>(undefined);
  readonly cursor = signal('');
  readonly dragging = signal(false);
  zIndex = 1;








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
      this.ext();
      untracked(() => this.loadExt());
    });
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

  private loadTag() {
    this.folderExts.set(undefined);
    this.parent.set(undefined);
    const tag = this.tag();
    if (tag?.includes('/')) {
      this.exts.getCachedExt(tag.substring(0, tag.lastIndexOf('/')), tagOrigin(tag) || '@')
        .subscribe(ext => this.parent.set(ext));
    }
    this.folderSubscription?.unsubscribe();
    if (!tag) return;
    this.folderSubscription = this.exts.page({
      query: defaultOrigin(tag, (this.ext()?.origin || '@')),
      level: level(tag) + 1,
      size: 100
    }).pipe(
      catchError(() => of(undefined)),
    ).subscribe(page => {
      this.folderExts.set(page?.content);
    });
  }

  private loadExt() {
    const ext = this.ext();
    this.files.set({});
    this.subfolders.set({});
    this.flatten.set(ext?.config?.flatten);
    if (!ext) return;
    this.cursor.set(ext.modifiedString!);
    this.files.set(mapValues(ext.config?.files || {}, p => this.transform(p)));
    const subfolders: Record<string, string | undefined> = {};
    for (const e of Object.entries<Pos>(ext.config?.subfolders || {})) {
      subfolders[ext.tag + (e[0] !== '..' ? '/' + e[0] : '')] = this.transform(e[1]);
    }
    this.subfolders.set(subfolders);
  }


  get local() {
    return this.ext()?.origin === this.store.account.origin;
  }


  startMoving(target: HTMLElement) {
    target.style.zIndex = ""+(this.zIndex++);
  }

  moveFile(url: string, target: HTMLElement) {
    if (!this.cursor()) return; // Wait for last move to complete
    if (!this.local) return;
    const cursor = this.cursor();
    this.cursor.set('');
    this.dragging.set(true)
    const pos = {
      x: Math.floor(target.getBoundingClientRect().x + window.scrollX - this.el.nativeElement.offsetLeft),
      y: Math.floor(target.getBoundingClientRect().y + window.scrollY - this.el.nativeElement.offsetTop),
    };
    this.exts.patch(this.ext()!.tag + this.store.account.origin, cursor, [{
      op: 'add',
      path: '/config/files/' + escapePath(url),
      value: pos,
    }]).subscribe(cursor => this.cursor.set(cursor));
  }

  moveFolder(tag: string, target: HTMLElement) {
    // TODO: write patches to websocket
    if (!this.cursor()) return; // Wait for last move to complete
    if (!this.local) return;
    const cursor = this.cursor();
    this.cursor.set('');
    this.dragging.set(true)
    this.exts.patch(this.ext()!.tag + this.store.account.origin, cursor, [{
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
