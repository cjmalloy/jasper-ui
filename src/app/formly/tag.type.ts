import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { FieldType, FieldTypeConfig, FormlyConfig } from '@ngx-formly/core';
import { debounce, defer } from 'lodash-es';
import { map, of, Subscription, switchMap } from 'rxjs';
import { AdminService } from '../service/admin.service';
import { ExtService } from '../service/api/ext.service';
import { ConfigService } from '../service/config.service';
import { Store } from '../store/store';
import { access } from '../util/tag';
import { getErrorMessage } from './errors';

@Component({
  standalone: false,
  selector: 'formly-field-tag-input',
  host: {'class': 'field'},
  template: `
    <div class="form-array">
      <div class="preview grow"
           type="text"
           [title]="input.value"
           [style.display]="preview ? 'block' : 'none'"
           (click)="clickPreview(input)"
           (focus)="edit(input)">{{ preview }}</div>
      <input #input
             class="grow"
             type="email"
             [attr.list]="id + '_list'"
             [class.hidden-without-removing]="preview"
             (input)="search(input.value)"
             (blur)="blur(input)"
             (focusin)="edit(input)"
             (focus)="edit(input)"
             (focusout)="getPreview(input.value)"
             [formControl]="formControl"
             [formlyAttributes]="field"
             [class.is-invalid]="showError">
      <datalist [id]="id + '_list'">
        @for (o of autocomplete; track o.value) {
          <option [value]="o.value">{{ o.label }}</option>
        }
      </datalist>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormlyFieldTagInput extends FieldType<FieldTypeConfig> implements AfterViewInit, OnDestroy {

  preview = '';
  autocomplete: { value: string, label: string }[] = [];

  private showedError = false;
  private searching?: Subscription;
  private formChanges?: Subscription;

  constructor(
    private configs: ConfigService,
    private config: FormlyConfig,
    private admin: AdminService,
    private exts: ExtService,
    public store: Store,
    private cd: ChangeDetectorRef,
  ) {
    super();
  }

  ngAfterViewInit() {
    this.field.hooks ||= {};
    this.field.hooks.afterViewInit = (field) => {
      this.getPreview(this.model[this.key as any]);
      this.formChanges?.unsubscribe();
      this.formChanges = field.formControl!.valueChanges.subscribe(() => {
        if (this.preview) {
          this.preview = '';
          this.getPreview(this.model[this.key as any]);
        }
      });
    }
  }

  ngOnDestroy() {
    this.searching?.unsubscribe();
    this.formChanges?.unsubscribe();
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
    }
    this.getPreview(input.value);
  }

  getPreview(value: string) {
    if (!value) return;
    if (this.showError) return;
    this.exts.getCachedExt(value, this.field.props.origin).pipe(
        switchMap(x => {
          if (x.modified && x.origin === (this.field.props.origin || this.store.account.origin)) return of(x);
          if (this.admin.getPlugin(x.tag)) return of(this.admin.getPlugin(x.tag));
          if (this.admin.getParentPlugins(x.tag).length) {
            const longestMatch = this.admin.getParentPlugins(x.tag)[this.admin.getParentPlugins(x.tag).length - 1];
            if (x.tag === longestMatch.tag) return of(longestMatch);
            const childTag = x.tag.substring(longestMatch.tag.length + 1);
            if (longestMatch.tag === 'plugin/outbox') {
              const origin = childTag.substring(0, childTag.indexOf('/'));
              const remoteTag = childTag.substring(origin.length + 1);
              const originFormat = origin ? ' @' + origin : '';
              return this.exts.getCachedExt(remoteTag, origin).pipe(
                  map(c => ({ name: (longestMatch.name || longestMatch.tag) + ' / ' + (c.name || c.tag) + originFormat })),
              );
            }
            let a = access(x.tag);
            let originFormat = '';
            if (childTag === 'user' || childTag.startsWith('user/')) {
              a ||= '+';
              originFormat = this.field.props.origin || '';
            }
            return this.exts.getCachedExt(a + childTag, this.field.props.origin).pipe(
                map(c => ({ name: (longestMatch.name || longestMatch.tag) + ' / ' + (c.name || c.tag) + originFormat })),
            );
          }
          if (this.field.type === 'plugin') return of(undefined);
          if (this.admin.getTemplates(x.tag).length) {
            const longestMatch = this.admin.getTemplates(x.tag)[this.admin.getTemplates(x.tag).length - 1];
            if (!longestMatch.tag) return of(undefined);
            if (x.tag === longestMatch.tag) return of(longestMatch);
            const childTag = x.tag.substring(longestMatch.tag.length + 1);
            return this.exts.getCachedExt(childTag, this.field.props.origin).pipe(
                map(c => ({ name: (longestMatch.name || longestMatch.tag) + ' / ' + (c.name || c.tag) })),
            );
          }
          if (x.modified) return of(x);
          return of(undefined);
        })
    ).subscribe((x?: { name?: string, tag?: string }) => {
      this.preview = x?.name || x?.tag || '';
      this.cd.detectChanges();
    });
  }

  edit(input: HTMLInputElement) {
    this.preview = '';
    input.focus();
  }

  clickPreview(input: HTMLInputElement) {
    if (this.store.hotkey) {
      window.open(this.configs.base + 'tag/' + input.value);
    } else {
      this.edit(input);
    }
  }

  search = debounce((value: string) => {
    this.searching?.unsubscribe();
    this.searching = this.exts.page({
      query: this.field.props.origin || this.store.account.origin || '@',
      search: value,
      size: 5,
    }).subscribe(page => {
      this.autocomplete = page.content.map(x => ({ value: x.tag, label: x.name || x.tag }));
    })
  }, 400)
}
