import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { catchError, switchMap, throwError } from 'rxjs';
import { pluginForm, PluginFormComponent } from '../../form/plugin/plugin.component';
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
  ) {
    this.editForm = pluginForm(fb);
  }

  ngOnInit(): void {
  }

  @ViewChild(PluginFormComponent)
  set form(form: PluginFormComponent) {
    if (!form) return;
    form.setValue(this.plugin);
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
    this.plugins.update(plugin).pipe(
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
