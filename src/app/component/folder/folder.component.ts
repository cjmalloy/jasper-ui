import { Component, HostBinding, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import { intersection, uniq } from 'lodash-es';
import { toJS } from 'mobx';
import { map, of, switchMap } from 'rxjs';
import { Ext } from '../../model/ext';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { ExtService } from '../../service/api/ext.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-folder',
  templateUrl: './folder.component.html',
  styleUrls: ['./folder.component.scss']
})
export class FolderComponent implements OnChanges {
  @HostBinding('class') css = 'folder ext';

  @Input()
  tag = '';
  @Input()
  ext?: Ext;
  @Input()
  pinned?: Ref[] | null;
  @Input()
  emptyMessage = '';

  error: any;

  flatten = false;
  subfolders: string[] = [];

  private _page?: Page<Ref>;

  constructor(
    private store: Store,
    private router: Router,
    private exts: ExtService,
  ) { }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.tag || changes.ext) {
      this.subfolders = [];
      this.flatten = this.ext?.config.flatten;
      if (this.ext) {
        this.subfolders = toJS(this.ext!.config.subfolders);
      }
      this.subfolderSearch();
    }
  }

  get page(): Page<Ref> | undefined {
    return this._page;
  }

  @Input()
  set page(value: Page<Ref> | undefined) {
    this._page = value;
    if (this._page) {
      if (this._page.number > 0 && this._page.number >= this._page.totalPages) {
        this.router.navigate([], {
          queryParams: {
            pageNumber: this._page.totalPages - 1
          },
          queryParamsHandling: "merge",
        })
      }
    }
  }

  subfolderSearch() {
    if (!this.tag) return;
    this.exts.page({
      search: this.tag + '/',
      size: 100
    }).pipe(
      map(page => this.getSubfolders(page.content.map(e => e.tag))),
      switchMap(subfolders => this.updateSubfolders(uniq([...this.subfolders, ...subfolders]))),
    ).subscribe();
  }

  private updateSubfolders(subfolders?: string[]) {
    if (!subfolders) return of(null);
    subfolders.sort();
    if (!this.different(subfolders)) return of(null);
    this.subfolders = subfolders;
    return this.exts.patch(this.tag, this.ext!.modifiedString!, [{
      op: 'add',
      path: '/config/subfolders',
      value: subfolders,
    }]);
  }

  get parent() {
    if (!this.tag.includes('/')) return '';
    return this.tag.substring(0, this.tag.lastIndexOf('/'));
  }

  getSubfolders(tags: string[], strict = false) {
    return uniq(tags
      .filter(t => t.startsWith(this.tag + '/'))
      .map(t => t.substring(this.tag.length + 1))
      .filter(t => !strict || !t.includes('/'))
      .map(t => t.includes('/') ? t.substring(0, t.indexOf('')) : t)
      .filter(t => t)
      .sort());
  }

  inSubfolder(ref: Ref) {
    const subfolders = this.getSubfolders(ref.tags || [], true);
    if (!subfolders.length) return false;
    let updated: string[] | null = null;
    for (const f of subfolders) {
      if (!this.subfolders.includes(f)) {
        updated ||= [...this.subfolders];
        updated.push(f);
      }
    }
    if (updated) {
      this.updateSubfolders(updated);
    }
    return true;
  }

  private different(subfolders: string[]) {
    if (this.subfolders.length != subfolders.length) return true;
    return intersection(this.subfolders, subfolders).length !== subfolders.length;
  }
}
