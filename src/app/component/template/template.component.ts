import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnChanges, QueryList, SimpleChanges, ViewChildren } from '@angular/core';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of, switchMap, throwError } from 'rxjs';
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
import { printError } from '../../util/http';
import { ActionComponent } from '../action/action.component';
import { ConfirmActionComponent } from '../action/confirm-action/confirm-action.component';
import { InlineButtonComponent } from '../action/inline-button/inline-button.component';

@Component({
  selector: 'app-template',
  templateUrl: './template.component.html',
  styleUrls: ['./template.component.scss'],
  imports: [RouterLink, ConfirmActionComponent, InlineButtonComponent, ReactiveFormsModule, TemplateFormComponent]
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
    this.templates.update(template).pipe(
      switchMap(() => this.templates.get(this.qualifiedTag)),
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(template => {
      this.editForm.reset();
      this.serverError = [];
      this.editing = false;
      this.template = template;
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

  download() {
    downloadTag(writeTemplate(this.template));
  }
}
