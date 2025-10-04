import { 
  ChangeDetectionStrategy,
  Component, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import { mapValues } from 'lodash-es';
import { toJS } from 'mobx';
import { catchError, of, Subscription } from 'rxjs';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Ext } from '../../model/ext';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { Pos } from '../../mods/folder';
import { ExtService } from '../../service/api/ext.service';
import { Store } from '../../store/store';
import { escapePath } from '../../util/json-patch';
import { defaultOrigin, level, tagOrigin } from '../../util/tag';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
  selector: 'app-folder',
  templateUrl: './folder.component.html',
  styleUrls: ['./folder.component.scss'],
  host: {'class': 'folder ext'}
})
export class FolderComponent implements OnChanges, HasChanges {

  @Input()
  tag?: string;
  @Input()
  ext?: Ext;
  @Input()
  pinned?: Ref[] | null;
  @Input()
  emptyMessage = '';

  error: any;

  parent?: Ext;
  flatten = false;
  files: Record<string, string | undefined> = {};
  subfolders: Record<string, string | undefined> = {};
  folderExts?: Ext[];
  cursor = '';
  dragging = false;
  zIndex = 1;

  private _page?: Page<Ref>;
  private folderSubscription?: Subscription;

  // TODO: handle resize moving relatively positioned moved tiles

  constructor(
    private store: Store,
    private router: Router,
    private exts: ExtService,
    private el: ElementRef<HTMLElement>,
  ) { }

  saveChanges() {
    // TODO
    return true;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.tag) {
      delete this.folderExts;
      delete this.parent;
      if (this.tag?.includes('/')) {
        this.exts.getCachedExt(this.tag.substring(0, this.tag.lastIndexOf('/')), tagOrigin(this.tag) || '@')
          .subscribe(ext => this.parent = ext);
      }
      this.folderSubscription?.unsubscribe();
      if (!this.tag) return;
      this.folderSubscription = this.exts.page({
        query: defaultOrigin(this.tag, (this.ext?.origin || '@')),
        level: level(this.tag) + 1,
        size: 100
      }).pipe(
        catchError(() => of(undefined)),
      ).subscribe(page => {
        this.folderExts = page?.content;
      });
    }
    if (changes.ext) {
      this.files = {};
      this.subfolders = {};
      this.flatten = this.ext?.config.flatten;
      if (!this.ext) return;
      this.cursor = this.ext.modifiedString!;
      this.files = mapValues(toJS(this.ext.config.files) || {}, p => this.transform(p));
      for (const e of Object.entries<Pos>(toJS(this.ext.config.subfolders) || {})) {
        this.subfolders[this.ext.tag + (e[0] !== '..' ? '/' + e[0] : '')] = this.transform(e[1]);
      }
    }
  }

  get local() {
    return this.ext?.origin === this.store.account.origin;
  }

  get page(): Page<Ref> | undefined {
    return this._page;
  }

  @Input()
  set page(value: Page<Ref> | undefined) {
    this._page = value;
    if (this._page) {
      if (this._page.page.number > 0 && this._page.page.number >= this._page.page.totalPages) {
        this.router.navigate([], {
          queryParams: {
            pageNumber: this._page.page.totalPages - 1
          },
          queryParamsHandling: "merge",
        });
      }
    }
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
      path: '/config/subfolders/' + (tag === this.tag ? '..' : escapePath(tag.substring(this.ext!.tag.length + 1))),
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
