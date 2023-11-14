import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { isObject } from 'lodash-es';
import { toJS } from 'mobx';
import { catchError, ignoreElements, Observable, switchMap, throwError } from 'rxjs';
import { extForm, ExtFormComponent } from '../../form/ext/ext.component';
import { Ext, writeExt } from '../../model/ext';
import { Plugin } from '../../model/plugin';
import { Template } from '../../model/template';
import { tagDeleteNotice } from '../../mods/delete';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { AuthzService } from '../../service/authz.service';
import { Store } from '../../store/store';
import { downloadTag } from '../../util/download';
import { scrollToFirstInvalid } from '../../util/form';
import { tagLink } from '../../util/format';
import { printError } from '../../util/http';
import { hasPrefix, parentTag } from '../../util/tag';

@Component({
  selector: 'app-ext',
  templateUrl: './ext.component.html',
  styleUrls: ['./ext.component.scss']
})
export class ExtComponent implements OnChanges {
  @HostBinding('class') css = 'ext list-item';
  @HostBinding('attr.tabindex') tabIndex = 0;

  @Input()
  ext!: Ext;

  editForm!: UntypedFormGroup;
  submitted = false;
  invalid = false;
  overwrite = true;
  force = false;
  icons: Template[] = [];
  template?: Template;
  plugin?: Plugin;
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

  ngOnChanges(changes: SimpleChanges) {
    if (changes.ext) {
      this.submitted = false;
      this.invalid = false;
      this.overwrite = false;
      this.force = false;
      this.template = this.admin.getTemplate(this.ext.tag);
      this.plugin = this.admin.getPlugin(this.ext.tag);
      this.editing = false;
      this.viewSource = false;
      this.deleting = false;
      this.deleted = false;
      this.writeAccess = false;
      this.serverError = [];
      if (this.ext) {
        this.icons = this.admin.getTemplateView(this.ext.tag);
        if (hasPrefix(this.ext.tag, 'user')) {
          this.icons.push({tag: 'user', config: { view: $localize`🧑️` }});
        }
        this.editForm = extForm(this.fb, this.ext, this.admin, true);
        this.writeAccess = this.auth.tagWriteAccess(this.qualifiedTag);
      } else {
        this.icons = [];
        this.writeAccess = false;
      }
    }
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

  get parent() {
    const p = parentTag(this.ext.tag);
    if (!p) return p;
    return tagLink(p, this.ext.origin, this.store.account.origin);
  }

  get local() {
    return this.ext.origin === this.store.account.origin;
  }

  get extLink() {
    return tagLink(this.ext.tag, this.ext.origin, this.store.account.origin);
  }

  save() {
    this.submitted = true;
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    let ext = {
      ...this.editForm.value,
      tag: this.ext.tag, // Need to fetch because control is disabled
      modifiedString: this.ext.modifiedString,
    };
    if (this.ext.upload || !this.invalid || !this.overwrite) {
      const config = this.ext.config;
      ext = {
        ...this.ext,
        ...ext,
        config: {
          ...isObject(config) ? config : {},
          ...ext.config,
        },
      }
    }
    if (this.ext.upload) {
      ext.upload = true;
      this.ext = ext;
      this.store.submit.setExt(this.ext);
    } else {
      this.exts.update(ext, this.force).pipe(
        switchMap(() => this.exts.get(this.qualifiedTag)),
        catchError((res: HttpErrorResponse) => {
          if (res.status === 400) {
            if (this.invalid) {
              this.force = true;
            } else {
              this.invalid = true;
            }
          }
          this.serverError = printError(res);
          return throwError(() => res);
        }),
      ).subscribe(tag => {
        this.serverError = [];
        this.editing = false;
        this.ext = tag;
      });
    }
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

  copy() {
    this.catchError(this.exts.create({
      ...this.ext,
      origin: this.store.account.origin,
    })).subscribe(() => {
      this.router.navigate(['/tag', this.ext.tag]);
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
    (this.admin.getPlugin('plugin/delete') ?
      this.exts.update(tagDeleteNotice(this.ext)).pipe(ignoreElements()) :
      this.exts.delete(this.qualifiedTag)).pipe(
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
