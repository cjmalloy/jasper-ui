import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { catchError, switchMap, throwError } from 'rxjs';
import { Template } from '../../model/template';
import { AdminService } from '../../service/admin.service';
import { TemplateService } from '../../service/api/template.service';
import { Store } from '../../store/store';
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
    this.editForm = fb.group({
      name: [''],
    });
  }

  ngOnInit(): void {
    this.editForm.patchValue(this.template);
  }

  get qualifiedTag() {
    return this.template.tag + this.template.origin;
  }

  save() {
    this.submitted = true;
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    this.templates.update({
      ...this.template,
      ...this.editForm.value,
    }).pipe(
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
    this.templates.delete(this.template.tag).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(() => {
      this.serverError = [];
      this.deleted = true;
    });
  }
}
