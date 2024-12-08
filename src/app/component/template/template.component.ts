import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, Observable, of, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { templateForm } from '../../form/template/template.component';
import { Template, writeTemplate } from '../../model/template';
import { tagDeleteNotice } from '../../mods/delete';
import { AdminService } from '../../service/admin.service';
import { TemplateService } from '../../service/api/template.service';
import { Store } from '../../store/store';
import { downloadTag } from '../../util/download';
import { scrollToFirstInvalid } from '../../util/form';
import { printError } from '../../util/http';

@Component({
  standalone: false,
  selector: 'app-template',
  templateUrl: './template.component.html',
  styleUrls: ['./template.component.scss']
})
export class TemplateComponent implements OnInit {
  css = 'template list-item';
  @HostBinding('attr.tabindex') tabIndex = 0;

  @Input()
  template!: Template;

  editForm: UntypedFormGroup;
  submitted = false;
  editing = false;
  viewSource = false;
  deleting = false;
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
    private router: Router,
  ) {
    this.editForm = templateForm(fb);
  }

  ngOnInit(): void {
    this.editForm.patchValue({
      ...this.template,
      config: this.template.config ? JSON.stringify(this.template.config, null, 2) : undefined,
      defaults: this.template.defaults ? JSON.stringify(this.template.defaults, null, 2) : undefined,
      schema: this.template.schema ? JSON.stringify(this.template.schema, null, 2) : undefined,
    });
  }

  @HostBinding('class')
  get pluginClass() {
    return this.css + ' ' + this.template.tag
      .replace(/[+_]/g, '')
      .replace(/\//g, '_')
      .replace(/\./g, '-');
  }

  get qualifiedTag() {
    return this.template.tag + this.template.origin;
  }

  get local() {
    return this.template.origin === this.store.account.origin;
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
      switchMap(() => this.templates.get(this.template.tag + this.template.origin)),
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(template => {
      this.serverError = [];
      this.editing = false;
      this.template = template;
    });
  }

  copy() {
    this.catchError(this.templates.create({
      ...this.template,
      origin: this.store.account.origin,
    })).subscribe(() => {
      this.router.navigate(['/tags', this.template.tag]);
    });
  }

  catchError(o: Observable<any>) {
    return o.pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    );
  }

  delete() {
    const deleteNotice = !this.template.tag.endsWith('/deleted') && this.admin.getPlugin('plugin/delete')
      ? this.templates.create(tagDeleteNotice(this.template))
      : of(null);
    return this.templates.delete(this.qualifiedTag).pipe(
      tap(() => this.deleted = true),
      switchMap(() => deleteNotice),
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(() => {
      this.serverError = [];
      this.deleting = false;
      this.deleted = true;
    });
  }

  download() {
    downloadTag(writeTemplate(this.template));
  }
}
