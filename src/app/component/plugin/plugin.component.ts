import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { catchError, switchMap, throwError } from 'rxjs';
import { Plugin } from '../../model/plugin';
import { AdminService } from '../../service/admin.service';
import { PluginService } from '../../service/api/plugin.service';
import { Store } from '../../store/store';
import { scrollToFirstInvalid } from '../../util/form';
import { printError } from '../../util/http';

@Component({
  selector: 'app-plugin',
  templateUrl: './plugin.component.html',
  styleUrls: ['./plugin.component.scss']
})
export class PluginComponent implements OnInit {
  @HostBinding('class') css = 'plugin list-item';
  @HostBinding('attr.tabindex') tabIndex = 0;

  @Input()
  plugin!: Plugin;

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
    private plugins: PluginService,
    private fb: UntypedFormBuilder,
  ) {
    this.editForm = fb.group({
      name: [''],
    });
  }

  ngOnInit(): void {
    this.editForm.patchValue(this.plugin);
  }

  get qualifiedTag() {
    return this.plugin.tag + this.plugin.origin;
  }

  save() {
    this.submitted = true;
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    this.plugins.update({
      ...this.plugin,
      ...this.editForm.value,
    }).pipe(
      switchMap(() => this.plugins.get(this.plugin.tag)),
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(tag => {
      this.serverError = [];
      this.editing = false;
      this.plugin = tag;
    });
  }

  delete() {
    this.plugins.delete(this.plugin.tag).pipe(
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
