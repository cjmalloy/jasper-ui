import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, Observable, switchMap, throwError } from 'rxjs';
import { IsTag } from '../../model/tag';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { PluginService } from '../../service/api/plugin.service';
import { TemplateService } from '../../service/api/template.service';
import { printError } from '../../util/http';

@Component({
  selector: 'app-tag',
  templateUrl: './tag.component.html',
  styleUrls: ['./tag.component.scss'],
})
export class TagComponent implements OnInit {
  @HostBinding('class') css = 'tag list-item';
  @HostBinding('attr.tabindex') tabIndex = 0;

  @Input()
  tag!: IsTag;

  editForm: UntypedFormGroup;
  submitted = false;
  _editing = false;
  deleting = false;
  @HostBinding('class.deleted')
  deleted = false;
  writeAccess$?: Observable<boolean>;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    private router: Router,
    private account: AccountService,
    private exts: ExtService,
    private plugins: PluginService,
    private templates: TemplateService,
    private fb: UntypedFormBuilder,
  ) {
    this.editForm = fb.group({
      name: [''],
    });
  }

  ngOnInit(): void {
    this.writeAccess$ = this.account.tagWriteAccess(this.tag.tag, this.tag.type);
    this.editForm.patchValue(this.tag);
  }

  get editing() {
    return this._editing;
  }

  set editing(value: boolean) {
    if (value && this.tag.type === 'ext') {
      this.router.navigate(['/tag', this.tag.tag, 'edit']);
    } else {
      this._editing = value;
    }
  }

  get qualifiedTag() {
    return this.tag.tag + this.tag.origin;
  }

  get service() {
    switch (this.tag.type) {
      case 'plugin': return this.plugins;
      case 'template': return this.templates;
    }
    throw 'Missing tag type!';
  }

  save() {
    this.submitted = true;
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) return;
    this.service.update({
      ...this.tag,
      ...this.editForm.value,
    }).pipe(
      switchMap(() => this.service.get(this.tag.tag)),
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(tag => {
      this.editing = false;
      this.tag = tag;
    });
  }

  delete() {
    this.service.delete(this.tag.tag).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.deleted = true;
    });
  }
}
