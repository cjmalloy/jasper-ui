import { ChangeDetectionStrategy, Component, ElementRef, inject, Input, ViewChild } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { defer } from 'lodash-es';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { Store } from '../../store/store';
import { getEl } from '../../util/html';
import { access, fixClientQuery, getStrictPrefix, localTag, tagOrigin } from '../../util/tag';

export type Crumb = { text: string, tag?: string, pos: number, len: number };

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-query',
  templateUrl: './query.component.html',
  styleUrls: ['./query.component.scss'],
  imports: [ReactiveFormsModule, RouterLink]
})
export class QueryComponent {
  private router = inject(Router);
  private exts = inject(ExtService);
  private admin = inject(AdminService);
  store = inject(Store);


  editing = false;
  select: boolean | Crumb[] = false;
  breadcrumbs: Crumb[] = [];

  private _query = '';

  get query(): string {
    return this._query;
  }

  @Input()
  set query(value: string) {
    if (this._query === value) return;
    this.editing = false;
    this._query = value;
    this.breadcrumbs = this.queryCrumbs(this._query);
  }

  @ViewChild("editor")
  set editor(ref: ElementRef<HTMLInputElement>) {
    const el = ref?.nativeElement;
    if (!el) return;
    if (!this._query) return;
    el.focus();
    if (!this.select) return;
    defer(() => {
      if (this.select === true) {
        el.select();
      } else if (this.select) {
        el.setSelectionRange(this.select[0].pos, this.select[1].pos + this.select[1].len);
      }
    });
  }

  click(event: MouseEvent, breadcrumb: Crumb): boolean {
    if (!this.store.hotkey) return true;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.edit([breadcrumb, breadcrumb]);
    return false;
  }

  edit(select: boolean | Crumb[]) {
    this.editing = true;
    if (select) {
      this.select = select;
    } else {
      this.select = false;
      const selection = document.getSelection();
      if (selection && selection.rangeCount > 0 && selection.toString()) {
        const range = selection.getRangeAt(0);
        const startCrumb = this.findCrumbFromNode(getEl(range.startContainer));
        const endCrumb = this.findCrumbFromNode(getEl(range.endContainer));
        if (startCrumb && endCrumb) {
          this.select = [startCrumb, endCrumb];
        }
      }
    }
  }

  private findCrumbFromNode(el: Element | null): Crumb | undefined {
    while (el) {
      if (el.classList.contains('crumb')) {
        const index = Array.from(el.parentElement?.children || []).indexOf(el);
        if (index >= 0 && index < this.breadcrumbs.length) {
          return this.breadcrumbs[index];
        }
      }
      el = el.parentElement;
    }
    return undefined;
  }

  search(query: string) {
    this.editing = false;
    query = query.toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\|+/g, '|')
      .replace(/[\s|]*:[\s|]*/g, ':')
      .replace(/\s+/g, '+')
      .replace(/[^_+/a-z-0-9.:|!@*()]+/g, '');
    if (this.store.view.current === 'tags') {
      this.router.navigate(['/tags', query], { queryParams: { pageNumber: null }, queryParamsHandling: 'merge' });
    } else {
      this.router.navigate(['/tag', query], { queryParams: { pageNumber: null }, queryParamsHandling: 'merge' });
    }
  }

  private queryCrumbs(query: string): Crumb[] {
    if (!query) return [];
    let read = 0;
    const result: Crumb[] = fixClientQuery(query).split(/([:|()])/g).filter(t => !!t).map(part => {
      const pos = read;
      const len = part.length;
      read += len;
      if (/[:|()]+/.test(part)) return { text: part, pos, len };
      return { text: '', tag: part, pos, len };
    });
    for (let i = 0; i < result.length - 2; i++) {
      const a = result[i];
      const op = result[i + 1];
      const b = result[i + 2];
      if (!a.tag || op.tag || !b.tag) continue;
      if (op.text !== '|') continue;
      if (tagOrigin(a.tag) !== tagOrigin(b.tag)) continue;
      const prefix = getStrictPrefix(a.tag, b.tag);
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
      if (!c.tag) c.text = this.store.account.querySymbol(...c.text.split('') as any);
      if (c.tag) return this.tagCrumbs(c.tag, c.pos, c.len);
      return c;
    });
  }

  private tagCrumbs(tag: string, pos: number, len: number) {
    let read = pos;
    const crumbs: Crumb[] = localTag(tag).split(/([/{},])/g).filter(t => !!t).map(text => {
      const pos = read;
      const len = text.length;
      read += len;
      return ({text, pos, len});
    });
    let prefix = '';
    for (let i = 0; i < crumbs.length; i++) {
      const previous = i > 1 ? crumbs[i-2].tag + '/' : '';
      if (crumbs[i].text === '{') {
        prefix = previous;
      }
      if (!/[/{},]/g.test(crumbs[i].text)) {
        crumbs[i].tag = (prefix || previous) + crumbs[i].text;
      } else {
        crumbs[i].text = this.store.account.querySymbol(crumbs[i].text as any);
      }
    }
    const origin = tagOrigin(tag);
    if (origin) {
      for (const t of crumbs) {
        if (t.tag) t.tag += origin;
      }
      crumbs.push({text: ' ', pos, len: 0 });
      crumbs.push({text: origin, tag: origin, pos: pos + len - origin.length, len: origin.length });
    }
    if (tag.startsWith('!')) {
      for (const t of crumbs) {
        if (t.text.startsWith('!')) t.text = t.text.substring(1);
      }
      const notOp = { text: this.store.account.querySymbol('!'), pos, len: 0 };
      if (notOp.text.startsWith(' ')) {
        crumbs.unshift(notOp);
      } else {
        crumbs.push(notOp);
      }
    }
    for (const t of crumbs) {
      const tag = t.tag?.startsWith('!') ? t.tag.substring(1) : t.tag;
      if (tag && !tag.startsWith('@')) {
        this.exts.getCachedExt(tag).subscribe(ext => {
          // TODO: possible delayed write
          if (ext.modifiedString && ext.name) {
            t.text = ext.name;
          } else if (ext.tag === 'plugin') {
            t.text = '📦';
          } else if (ext.tag === '+plugin') {
            t.text = '+📦';
          } else if (ext.tag === '_plugin') {
            t.text = '_📦';
          } else {
            const template = this.admin.getTemplate(ext.tag);
            if (template?.name) {
              t.text = template.name;
            } else {
              const plugin = this.admin.getPlugin(ext.tag);
              if (plugin?.name) t.text = plugin.name;
            }
          }
        });
      }
    }
    return crumbs;
  }

  blur(value: string) {
    if (value === this.query) {
      this.editing = false;
    }
  }
}

