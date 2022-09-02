import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { extForm, ExtFormComponent } from '../../form/ext/ext.component';
import { Ext } from '../../model/ext';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { PluginService } from '../../service/api/plugin.service';
import { TemplateService } from '../../service/api/template.service';
import { AuthService } from '../../service/auth.service';
import { scrollToFirstInvalid } from '../../util/form';
import { printError } from '../../util/http';

@Component({
  selector: 'app-ext',
  templateUrl: './ext.component.html',
  styleUrls: ['./ext.component.scss']
})
export class ExtComponent implements OnInit {
  @HostBinding('class') css = 'ext list-item';
  @HostBinding('attr.tabindex') tabIndex = 0;

  @Input()
  ext!: Ext;

  editForm!: UntypedFormGroup;
  submitted = false;
  _editing = false;
  deleting = false;
  @HostBinding('class.deleted')
  deleted = false;
  writeAccess = false;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    private router: Router,
    private auth: AuthService,
    private exts: ExtService,
    private plugins: PluginService,
    private templates: TemplateService,
    private fb: UntypedFormBuilder,
  ) {
  }

  ngOnInit(): void {
    this.writeAccess = this.auth.tagWriteAccess(this.ext.tag, this.ext.type);
  }

  @ViewChild(ExtFormComponent)
  set extForm(value: ExtFormComponent) {
    this.editForm = extForm(this.fb, this.ext, this.admin);
    this.editForm.patchValue(this.ext);
  }

  get editing() {
    return this._editing;
  }

  set editing(value: boolean) {
    this._editing = value;
  }

  get qualifiedTag() {
    return this.ext.tag + this.ext.origin;
  }

  save() {
    this.submitted = true;
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    this.exts.update({
      ...this.ext,
      ...this.editForm.value,
    }).pipe(
      switchMap(() => this.exts.get(this.ext.tag)),
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(tag => {
      this.serverError = [];
      this.editing = false;
      this.ext = tag;
    });
  }

  delete() {
    this.exts.delete(this.ext.tag).pipe(
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
