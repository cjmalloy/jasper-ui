import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ExtService } from '../../service/api/ext.service';
import { access, fixClientQuery, getLargestPrefix, localTag, tagOrigin } from '../../util/tag';
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
      .replace(/[^_+/a-z-0-9.:|!@*()]+/g, '');
    this.router.navigate(['/tag', query], { queryParams: { pageNumber: null },  queryParamsHandling: 'merge'});
  }

  private queryCrumbs(query: string): Crumb[] {
    if (!query) return [];
    const result: Crumb[] = fixClientQuery(query).split(/([:|()])/g).filter(t => !!t).map(part => {
      if (/[:|()]+/.test(part)) return { text: part };
      return { text: '', tag: part };
    });
    for (let i = 0; i < result.length - 2; i++) {
      const a = result[i];
      const op = result[i + 1];
      const b = result[i + 2];
      if (!a.tag || op.tag || !b.tag) continue;
      if (op.text !== '|') continue;
      if (tagOrigin(a.tag) !== tagOrigin(b.tag)) continue;
      const prefix = getLargestPrefix(a.tag, b.tag);
      if (prefix) {
        const origin = tagOrigin(a.tag);
        const as = access(a.tag) + localTag(a.tag).substring(prefix.length + 1);
        const bs = access(b.tag) + localTag(b.tag).substring(prefix.length + 1);
        if (!as.startsWith('{')) {
          result[i].tag = prefix + '/{' + as + ',' + bs + '}' + origin;
        } else {
          result[i].tag = prefix + '/' + as.substring(0, as.length - 1) + ',' + bs + '}' + origin;
        }
        result.splice(i + 1, 2);
        i--;
      }
    }
    // (blog/a/b|blog/a/c):(kanban/jasper/content|kanban/jasper/testing)
    for (let i = 0; i < result.length - 2; i++) {
      const op1 = result[i];
      const a = result[i + 1];
      const op2 = result[i + 2];
      if (a.tag && op1.text === '(' && op2.text === ')') {
        result.splice(i + 2, 1);
        result.splice(i, 1);
      }
    }
    return result.flatMap(c => {
      if (!c.tag) return [{ text: this.querySymbol(...c.text.split('') as any)}];
      if (c.tag) return this.tagCrumbs(c.tag);
      return c;
    });
  }

  // (kanban/jasper/testing|kanban/jasper/content):!doing/dev
  private querySymbol(...ops: ('/' | '{' | '}' | ',' | ':' | '|' | '(' | ')' | `!`)[]): string {
    return ops.map(op => {
      switch (op) {
        case '/': return $localize`\u00A0/ `;
        case ':': return $localize` ∩ `;
        case '|': return $localize` ∪ `;
        case '(': return $localize` (\u00A0`;
        case ')': return $localize`\u00A0) `;
        case `!`: return $localize` ¬`;
        case `{`: return $localize` {\u00A0`;
        case `}`: return $localize`\u00A0} `;
        case `,`: return $localize`, `;
      }
      return op;
    }).join(' ');
  }

  private tagCrumbs(tag: string) {
    const crumbs: Crumb[] = localTag(tag).split(/([/{},])/g).filter(t => !!t).map(text => ({ text }));
    let prefix = '';
    for (let i = 0; i < crumbs.length; i++) {
      const previous = i > 1 ? crumbs[i-2].tag + '/' : '';
      if (crumbs[i].text === '{') {
        prefix = previous;
      }
      if (!/[/{},]/g.test(crumbs[i].text)) {
        crumbs[i].tag = (prefix || previous) + crumbs[i].text;
      } else {
        crumbs[i].text = this.querySymbol(crumbs[i].text as any);
      }
    }
    const origin = tagOrigin(tag);
    if (origin) {
      for (const t of crumbs) {
        if (t.tag) t.tag += origin;
      }
      crumbs.push({text: origin, tag: origin });
    }
    if (tag.startsWith('!')) {
      for (const t of crumbs) {
        if (t.text.startsWith('!')) t.text = t.text.substring(1);
      }
      crumbs.unshift({ text: this.querySymbol(`!`) });
    }
    for (const t of crumbs) {
      const tag = t.tag?.startsWith('!') ? t.tag.substring(1) : t.tag;
      if (tag && !tag.startsWith('@')) {
        this.exts.getCachedExt(tag).subscribe(ext => {
          // TODO: possible delayed write
          if (ext?.modifiedString && ext?.name) {
            t.text = ext.name;
          } else {
            const template = this.admin.getTemplate(localTag(tag));
            if (template?.name) t.text = template.name;
          }
        });
      }
    }
    return crumbs;
  }
}

