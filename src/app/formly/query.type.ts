import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { FieldType, FieldTypeConfig, FormlyConfig } from '@ngx-formly/core';
import { debounce, defer, delay, uniqBy } from 'lodash-es';
import { forkJoin, map, Observable, of, Subscription, switchMap } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { Crumb } from '../component/query/query.component';
import { Config } from '../model/tag';
import { AdminService } from '../service/admin.service';
import { ExtService } from '../service/api/ext.service';
import { ConfigService } from '../service/config.service';
import { EditorService } from '../service/editor.service';
import { Store } from '../store/store';
import { access, fixClientQuery, getStrictPrefix, localTag, tagOrigin } from '../util/tag';
import { getErrorMessage } from './errors';

@Component({
  standalone: false,
  selector: 'formly-field-query-input',
  host: {'class': 'field'},
  styles: `
    .form-array {
      position: relative;
    }
    .preview {
      pointer-events: none;
    }
    .breadcrumbs {
      position: absolute;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding-block: 2px;
      padding-inline: 8px;
      * {
        color: var(--text);
        text-decoration: none;
        cursor: text;
      }
      .op {
        font-family: KaTeX_Main, "Times New Roman", serif;
      }
    }
  `,
  template: `
    <div class="form-array skip-margin">
      <input class="preview grow"
             type="text"
             [style.display]="preview ? 'block' : 'none'">
      <div #div
           class="breadcrumbs"
           [title]="input.value"
           [style.display]="preview ? 'block' : 'none'"
           (click)="$event.target === div && edit(input, false)">
        @for (breadcrumb of breadcrumbs; track breadcrumb) {
          <span class="crumb">
              @if (breadcrumb.tag) {
                <a class="tag" [routerLink]="['/tag', breadcrumb.tag]" queryParamsHandling="merge"><span (click)="clickPreview(input, $event, breadcrumb)">{{ breadcrumb.text }}</span></a>
              } @else {
                <span class="op" (click)="edit(input, breadcrumb)">{{ breadcrumb.text }}</span>
              }
            </span>
        }
      </div>
      <datalist [id]="listId">
        @for (o of autocomplete; track o.value) {
          <option [value]="o.value">{{ o.label }}</option>
        }
      </datalist>
      <input #input
             class="grow"
             type="text"
             enterkeyhint="enter"
             autocorrect="off"
             autocapitalize="none"
             [attr.list]="listId"
             [class.hidden-without-removing]="preview"
             (input)="search(input.value)"
             (blur)="blur(input)"
             (focusin)="edit(input, false)"
             (focus)="edit(input, false)"
             (focusout)="getPreview(input.value)"
             [formControl]="formControl"
             [formlyAttributes]="field"
             [class.is-invalid]="showError">
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormlyFieldQueryInput extends FieldType<FieldTypeConfig> implements AfterViewInit, OnDestroy {

  listId = 'list-' + uuid();
  breadcrumbs: Crumb[] = [];
  editing = false;
  autocomplete: { value: string, label: string }[] = [];

  private showedError = false;
  private searching?: Subscription;
  private formChanges?: Subscription;
  private _query = '';

  constructor(
    private router: Router,
    private config: FormlyConfig,
    private admin: AdminService,
    private editor: EditorService,
    private exts: ExtService,
    public store: Store,
    private cd: ChangeDetectorRef,
  ) {
    super();
  }

  ngAfterViewInit() {
    if (this.model) this.getPreview(this.model[this.key as any]);
    this.formChanges?.unsubscribe();
    this.formChanges = this.formControl.valueChanges.subscribe(value => {
      if (!this.editing) {
        if (value) {
          this.getPreview(value);
        } else {
          this.query = '';
        }
      }
    });
  }

  ngOnDestroy() {
    this.searching?.unsubscribe();
    this.formChanges?.unsubscribe();
  }

  get preview() {
    return !this.editing && this.query;
  }

  get query(): string {
    return this._query;
  }

  set query(value: string) {
    this.editing = false;
    this.cd.detectChanges();
    if (this._query === value) return;
    this._query = value;
    this.breadcrumbs = this.queryCrumbs(this._query);
    this.cd.detectChanges();
  }

  validate(input: HTMLInputElement) {
    if (this.showError) {
      input.setCustomValidity(getErrorMessage(this.field, this.config));
      input.reportValidity();
    }
  }

  blur(input: HTMLInputElement) {
    if (this.showError && !this.showedError) {
      this.showedError = true;
      defer(() => this.validate(input));
    } else {
      this.showedError = false;
      this.getPreview(input.value);
    }
  }

  getPreview(value: string) {
    if (!value) return;
    if (this.showError) return;
    this.query = value;
  }

  preview$(value: string): Observable<{ name?: string, tag: string } | undefined> {
    return this.editor.getTagPreview(
      value,
      this.field.props.origin || this.store.account.origin,
      false,
      this.field.type !== 'plugin',
      this.field.type !== 'template');
  }

  clickPreview(input: HTMLInputElement, event: MouseEvent, breadcrumb: Crumb): boolean {
    if (this.store.hotkey) {
      this.router.navigate(['/tag', breadcrumb.tag]);
    } else {
      this.edit(input, breadcrumb);
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    return false;
  }

  edit(input: HTMLInputElement, select: boolean | Crumb) {
    this.editing = true;
    this.cd.detectChanges();
    input.focus();
    if (select === true) {
      input.select();
    } else if (select) {
      input.setSelectionRange(select.pos, select.pos + select.len);
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
        this.exts.get(tag).subscribe(ext => {
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
          this.cd.detectChanges();
        });
      }
    }
    return crumbs;
  }

  search = debounce((text: string) => {
    text = text.replace(/\s+$/, '');
    const parts = text.split(/[:|()\s]+/).filter(t => !!t);
    const value = parts.pop() || '';
    const prefix = text.substring(0, text.length - value.length)
    const tag = value.replace(/[^_+a-z0-9./@]/, '').toLowerCase();
    const toEntry = (p: Config) => ({ value: p.tag, label: p.name || p.tag });
    const getPlugins = (text: string, size = 5) => this.admin.searchPlugins(text).slice(0, size).map(toEntry);
    const getTemplates = (text: string, size = 5) => this.admin.searchTemplates(text).slice(0, size).map(toEntry);
    this.searching?.unsubscribe();
    this.searching = this.exts.page({
      query: this.props.prefix || '',
      search: tag,
      sort: ['nesting', 'levels'],
      size: 5,
    }).pipe(
      switchMap(page => page.page.totalElements ? forkJoin(page.content.map(x => this.preview$(x.tag + x.origin))) : of([])),
      map(xs => xs.filter(x => !!x) as { name?: string, tag: string }[]),
    ).subscribe(xs => {
      this.autocomplete = xs.map(x => ({ value: prefix + x.tag, label: x.name || x.tag }));
      if (this.autocomplete.length < 5) this.autocomplete.push(...getPlugins(tag, 5 - this.autocomplete.length));
      if (this.autocomplete.length < 5) this.autocomplete.push(...getTemplates(tag, 5 - this.autocomplete.length));
      this.autocomplete = uniqBy(this.autocomplete, 'value')
      this.cd.detectChanges();
    });
  }, 400);
}
