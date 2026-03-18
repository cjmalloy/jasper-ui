import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnChanges, QueryList, SimpleChanges, ViewChildren } from '@angular/core';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { isEqual } from 'lodash-es';
import { catchError, of, Subscription, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { templateForm, TemplateFormComponent } from '../../form/template/template.component';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Template, writeTemplate } from '../../model/template';
import { isDeletorTag, tagDeleteNotice } from '../../mods/delete';
import { AdminService } from '../../service/admin.service';
import { TemplateService } from '../../service/api/template.service';
import { Store } from '../../store/store';
import { downloadTag } from '../../util/download';
import { scrollToFirstInvalid } from '../../util/form';
import { modId } from '../../util/format';
import { printError } from '../../util/http';
import { ActionComponent } from '../action/action.component';
import { ConfirmActionComponent } from '../action/confirm-action/confirm-action.component';
import { InlineButtonComponent } from '../action/inline-button/inline-button.component';
import { LoadingComponent } from '../loading/loading.component';

@Component({
  selector: 'app-template',
  templateUrl: './template.component.html',
  styleUrls: ['./template.component.scss'],
  imports: [RouterLink, ConfirmActionComponent, InlineButtonComponent, ReactiveFormsModule, TemplateFormComponent, LoadingComponent]
})
export class TemplateComponent implements OnChanges, HasChanges {
  css = 'template list-item';
  @HostBinding('attr.tabindex') tabIndex = 0;

  @ViewChildren('action')
  actionComponents?: QueryList<ActionComponent>;

  @Input()
  template!: Template;

  editForm: UntypedFormGroup;
  submitted = false;
  editing = false;
  viewSource = false;
  @HostBinding('class.deleted')
  deleted = false;
  serverError: string[] = [];
  configErrors: string[] = [];
  defaultsErrors: string[] = [];
  schemaErrors: string[] = [];
  saving?: Subscription;

  constructor(
    public admin: AdminService,
    public store: Store,
    private templates: TemplateService,
    private fb: UntypedFormBuilder,
  ) {
    this.editForm = templateForm(fb);
  }

  saveChanges() {
    return !this.editing || !this.editForm.dirty;
  }

  init(): void {
    this.actionComponents?.forEach(c => c.reset());
    this.editForm.patchValue({
      ...this.template,
      config: this.template.config ? JSON.stringify(this.template.config, null, 2) : undefined,
      defaults: this.template.defaults ? JSON.stringify(this.template.defaults, null, 2) : undefined,
      schema: this.template.schema ? JSON.stringify(this.template.schema, null, 2) : undefined,
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.template) {
      this.init();
    }
  }

  @HostBinding('class')
  get pluginClass() {
    return this.css + ' ' + this.template.tag
      .replace(/[+_]/g, '')
      .replace(/\//g, '_')
      .replace(/\./g, '-');
  }

  get created() {
    return !!this.template.modified;
  }

  get qualifiedTag() {
    return this.template.tag + this.origin;
  }

  get origin() {
    return this.template.origin || '';
  }

  get local() {
    return this.origin === this.store.account.origin;
  }

  save() {
    this.submitted = true;
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const template = {
      ...this.template,
      ...this.editForm.value,
    };
    this.configErrors = [];
    this.defaultsErrors = [];
    this.schemaErrors = [];
    try {
      if (!template.config) delete template.config;
      if (template.config) template.config = JSON.parse(template.config);
    } catch (e: any) {
      this.configErrors.push(e.message);
    }
    try {
      if (!template.defaults) delete template.defaults;
      if (template.defaults) template.defaults = JSON.parse(template.defaults);
    } catch (e: any) {
      this.defaultsErrors.push(e.message);
    }
    try {
      if (!template.schema) delete template.schema;
      if (template.schema) template.schema = JSON.parse(template.schema);
    } catch (e: any) {
      this.schemaErrors.push(e.message);
    }
    if (this.configErrors.length || this.defaultsErrors.length || this.schemaErrors.length) return;
    this.saving = this.templates.update(template).pipe(
      switchMap(() => this.templates.get(this.qualifiedTag)),
      catchError((err: HttpErrorResponse) => {
        delete this.saving;
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(template => {
      delete this.saving;
      this.editForm.reset();
      this.serverError = [];
      this.editing = false;
      this.template = template;
      delete this.admin.status.templates[template.tag];
      delete this.admin.status.disabledTemplates[template.tag];
      if (template.config?.disabled) {
        this.admin.status.disabledTemplates[template.tag] = template;
      } else {
        this.admin.status.templates[template.tag] = template;
      }
    });
  }

  copy$ = () => {
    return this.templates.create({
      ...this.template,
      origin: this.store.account.origin,
    }).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    );
  }

  delete$ = () => {
    const deleteNotice = !isDeletorTag(this.template.tag) && this.admin.getPlugin('plugin/delete')
      ? this.templates.create(tagDeleteNotice(this.template))
      : of(null);
    return this.templates.delete(this.qualifiedTag).pipe(
      switchMap(() => deleteNotice),
      tap(() => {
        this.serverError = [];
        this.deleted = true;
      }),
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    );
  }

  get canReset() {
    return this.created && this.local && this.store.account.admin && this.hasCustomChanges;
  }

  reset$ = () => {
    const current = this.template;
    const restored = this.admin.getInstalledTemplate(modId(this.template), this.template.tag);
    if (restored) {
      this.template = { ...this.template, ...restored, origin: this.store.account.origin };
      this.updateTemplateStatus(this.template);
    }
    this.serverError = [];
    this.editing = false;
    this.init();
    return this.admin.resetTemplate$(current, () => {});
  }

  download() {
    downloadTag(writeTemplate(this.template));
  }

  private get hasCustomChanges() {
    const installed = this.admin.getInstalledTemplate(modId(this.template), this.template.tag);
    return !!installed && !isEqual(this.normalizeTemplate(this.template), this.normalizeTemplate(installed));
  }

  private normalizeTemplate(template: Template) {
    const result = writeTemplate({ ...template, origin: '' }) as Template & { config?: Record<string, unknown> };
    result.config &&= { ...result.config };
    delete (result as Template & { modified?: unknown, modifiedString?: unknown }).modified;
    delete (result as Template & { modified?: unknown, modifiedString?: unknown }).modifiedString;
    delete (result as Template & { _needsUpdate?: unknown })._needsUpdate;
    delete result.config?.version;
    delete result.config?.generated;
    delete result.config?._parent;
    return result;
  }

  private updateTemplateStatus(template: Template) {
    delete this.admin.status.templates[template.tag];
    delete this.admin.status.disabledTemplates[template.tag];
    if (template.config?.disabled) {
      this.admin.status.disabledTemplates[template.tag] = template;
    } else {
      this.admin.status.templates[template.tag] = template;
    }
  }
}
