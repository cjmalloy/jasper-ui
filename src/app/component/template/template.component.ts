import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { catchError, switchMap, throwError } from 'rxjs';
import { templateForm, TemplateFormComponent } from '../../form/template/template.component';
import { Template, writeTemplate } from '../../model/template';
import { AdminService } from '../../service/admin.service';
import { TemplateService } from '../../service/api/template.service';
import { Store } from '../../store/store';
import { downloadTag } from '../../util/download';
import { scrollToFirstInvalid } from '../../util/form';
import { printError } from '../../util/http';

@Component({
  selector: 'app-template',
  templateUrl: './template.component.html',
  styleUrls: ['./template.component.scss']
})
export class TemplateComponent implements OnInit {
  @HostBinding('class') css = 'template list-item';
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

  constructor(
    public admin: AdminService,
    public store: Store,
    private templates: TemplateService,
    private fb: UntypedFormBuilder,
  ) {
    this.editForm = templateForm(fb);
  }

  ngOnInit(): void {
  }

  @ViewChild(TemplateFormComponent)
  set form(form: TemplateFormComponent) {
    if (!form) return;
    form.setValue(this.template);
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
    this.templates.update(template).pipe(
      switchMap(() => this.templates.get(this.template.tag)),
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

  delete() {
    this.templates.delete(this.qualifiedTag).pipe(
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
