import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { toJS } from 'mobx';
import { catchError, switchMap, throwError } from 'rxjs';
import { extForm, ExtFormComponent } from '../../form/ext/ext.component';
import { Ext } from '../../model/ext';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { AuthService } from '../../service/auth.service';
import { Store } from '../../store/store';
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
  editing = false;
  deleting = false;
  @HostBinding('class.deleted')
  deleted = false;
  writeAccess = false;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    private store: Store,
    private auth: AuthService,
    private exts: ExtService,
    private fb: UntypedFormBuilder,
  ) { }

  ngOnInit(): void {
    this.editForm = extForm(this.fb, this.ext, this.admin);
    this.writeAccess = this.auth.tagWriteAccess(this.qualifiedTag);
  }

  @ViewChild(ExtFormComponent)
  set extForm(value: ExtFormComponent) {
    value?.setValue(toJS(this.ext));
  }

  get qualifiedTag() {
    return this.ext.tag + this.ext.origin;
  }

  get local() {
    return this.ext.origin === this.store.account.origin;
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
      switchMap(() => this.exts.get(this.qualifiedTag)),
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
    this.exts.delete(this.qualifiedTag).pipe(
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
}
