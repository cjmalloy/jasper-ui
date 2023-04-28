import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { toJS } from 'mobx';
import { catchError, Observable, switchMap, throwError } from 'rxjs';
import { extForm, ExtFormComponent } from '../../form/ext/ext.component';
import { Ext, writeExt } from '../../model/ext';
import { Template } from '../../model/template';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { AuthzService } from '../../service/authz.service';
import { Store } from '../../store/store';
import { downloadTag } from '../../util/download';
import { scrollToFirstInvalid } from '../../util/form';
import { printError } from '../../util/http';
import { hasPrefix } from '../../util/tag';

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
  icons: Template[] = [];
  editing = false;
  viewSource = false;
  deleting = false;
  @HostBinding('class.deleted')
  deleted = false;
  writeAccess = false;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    public store: Store,
    private auth: AuthzService,
    private exts: ExtService,
    private fb: UntypedFormBuilder,
    private router: Router,
  ) { }

  ngOnInit(): void {
    this.icons = this.admin.getTemplateView(this.ext.tag);
    if (hasPrefix(this.ext.tag, 'user')) {
      this.icons.push({tag: 'user', config: { view: $localize`👤️` }});
    }
    this.editForm = extForm(this.fb, this.ext, this.admin, true);
    this.writeAccess = this.auth.tagWriteAccess(this.qualifiedTag);
  }

  @HostBinding('class.upload')
  get uploadedFile() {
    return this.ext.upload;
  }

  @HostBinding('class.exists')
  get existsFile() {
    return this.ext.exists;
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
    const ext = {
      ...this.ext,
      ...this.editForm.value,
      tag: this.ext.tag, // Need to fetch because control is disabled
      config: {
        ...this.admin.getDefaults(this.ext.tag),
        ...this.ext.config,
        ...this.editForm.value.config,
      },
    };
    if (this.ext.upload) {
      ext.upload = true;
      this.ext = ext;
      this.upload();
    }
    this.exts.update(ext).pipe(
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

  upload() {
    this.ext.origin = this.store.account.origin;
    this.catchError((this.store.submit.overwrite ? this.exts.push(this.ext) : this.exts.create(this.ext))).pipe(
      switchMap(() => this.exts.get(this.ext.tag + this.ext.origin))
    ).subscribe(ext => {
      this.ext = ext;
      this.store.submit.setExt(ext);
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

  download() {
    downloadTag(writeExt(this.ext));
  }

  clickIcon(i: Template) {
    this.router.navigate(['/tag', this.store.view.toggleTag(i.tag)], { queryParamsHandling: 'merge' });
  }
}
