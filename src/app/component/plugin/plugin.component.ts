import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, Observable, switchMap, throwError } from 'rxjs';
import { pluginForm } from '../../form/plugin/plugin.component';
import { Plugin, writePlugin } from '../../model/plugin';
import { AdminService } from '../../service/admin.service';
import { PluginService } from '../../service/api/plugin.service';
import { Store } from '../../store/store';
import { downloadTag } from '../../util/download';
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
  viewSource = false;
  deleting = false;
  @HostBinding('class.deleted')
  deleted = false;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    public store: Store,
    private plugins: PluginService,
    private fb: UntypedFormBuilder,
    private router: Router,
  ) {
    this.editForm = pluginForm(fb);
  }

  ngOnInit(): void {
    this.editForm.patchValue({
      ...this.plugin,
      config: this.plugin.config ? JSON.stringify(this.plugin.config, null, 2) : undefined,
      defaults: this.plugin.defaults ? JSON.stringify(this.plugin.defaults, null, 2) : undefined,
      schema: this.plugin.schema ? JSON.stringify(this.plugin.schema, null, 2) : undefined,
    });
  }

  get qualifiedTag() {
    return this.plugin.tag + this.plugin.origin;
  }

  get local() {
    return this.plugin.origin === this.store.account.origin;
  }

  save() {
    this.submitted = true;
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const plugin = {
      ...this.plugin,
      ...this.editForm.value,
    };
    if (!plugin.config) delete plugin.config;
    if (plugin.config) plugin.config = JSON.parse(plugin.config);
    if (!plugin.defaults) delete plugin.defaults;
    if (plugin.defaults) plugin.defaults = JSON.parse(plugin.defaults);
    if (!plugin.schema) delete plugin.schema;
    if (plugin.schema) plugin.schema = JSON.parse(plugin.schema);
    this.plugins.update(plugin).pipe(
      switchMap(() => this.plugins.get(this.plugin.tag + this.plugin.origin)),
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

  copy() {
    this.catchError(this.plugins.create({
      ...this.plugin,
      origin: this.store.account.origin,
    })).subscribe(() => {
      this.router.navigate(['/tag', this.plugin.tag]);
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
    this.plugins.delete(this.qualifiedTag).pipe(
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
    downloadTag(writePlugin(this.plugin));
  }
}
