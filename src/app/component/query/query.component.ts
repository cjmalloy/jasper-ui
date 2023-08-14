import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ExtService } from '../../service/api/ext.service';
import { fixClientQuery, localTag, tagOrigin } from '../../util/tag';
import { AdminService } from '../../service/admin.service';

export type Crumb = { text: string, tag?: string };

@Component({
  selector: 'app-query',
  templateUrl: './query.component.html',
  styleUrls: ['./query.component.scss']
})
export class QueryComponent implements OnInit {

  editing = false;

  private _query = '';
  breadcrumbs: Crumb[] = [];

  constructor(
    private router: Router,
    private exts: ExtService,
    private admin: AdminService,
  ) { }

  ngOnInit(): void {
  }

  get query(): string {
    return this._query;
  }

  @Input()
  set query(value: string) {
    this._query = value;
    this.breadcrumbs = this.queryCrumbs(this._query);
  }

  @ViewChild("editor")
  set editor(ref: ElementRef) {
    if (this._query) ref?.nativeElement.focus();
  }

  search(query: string) {
    this.editing = false;
    query = query.toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\|+/g, '|')
      .replace(/[\s|]*:[\s|]*/g, ':')
      .replace(/\s+/g, '+')
      .replace(/[^_+/a-z-0-9.:|!@()]+/g, '');
    this.router.navigate(['/tag', query], { queryParams: { pageNumber: null },  queryParamsHandling: 'merge'});
  }

  private queryCrumbs(query: string): Crumb[] {
    if (!query) return [];
    return fixClientQuery(query).split(/([:|()])/g).flatMap(t => {
      if (/[:|()]/.test(t)) return [{ text: t }];
      return this.tagCrumbs(t);
    });
  }

  private tagCrumbs(tag: string) {
    const crumbs: Crumb[] = localTag(tag).split(/(\/)/g).map(t => ({ text: t }));
    for (let i = 0; i < crumbs.length; i++) {
      const previous = i > 1 ? crumbs[i-2].tag + '/' : '';
      if (crumbs[i].text !== '/') {
        crumbs[i].tag = previous + crumbs[i].text;
      }
    }
    const origin = tagOrigin(tag);
    if (origin) {
      for (const t of crumbs) {
        if (t.tag) t.tag += origin;
      }
      crumbs.push({text: origin, tag: origin });
    }
    for (const t of crumbs) {
      if (t.tag && !t.tag.startsWith('@')) {
        this.exts.getCachedExt(t.tag).subscribe(ext => {
          if (ext?.modifiedString && ext?.name) {
            t.text = ext.name;
          } else {
            const template = this.admin.getTemplate(localTag(t.tag));
            if (template?.name) t.text = template.name;
          }
        });
      }
    }
    return crumbs;
  }
}

