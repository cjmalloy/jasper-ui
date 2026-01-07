import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnChanges, QueryList, SimpleChanges, ViewChildren } from '@angular/core';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of, Subscription, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { pluginForm, PluginFormComponent } from '../../form/plugin/plugin.component';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Plugin, writePlugin } from '../../model/plugin';
import { isDeletorTag, tagDeleteNotice } from "../../mods/delete";
import { AdminService } from '../../service/admin.service';
import { PluginService } from '../../service/api/plugin.service';
import { ModService } from '../../service/mod.service';
import { Store } from '../../store/store';
import { downloadPluginExport, downloadTag } from '../../util/download';
import { scrollToFirstInvalid } from '../../util/form';
import { printError } from '../../util/http';
import { ActionComponent } from '../action/action.component';
import { ConfirmActionComponent } from '../action/confirm-action/confirm-action.component';
import { InlineButtonComponent } from '../action/inline-button/inline-button.component';
import { LoadingComponent } from '../loading/loading.component';

@Component({
  selector: 'app-plugin',
  templateUrl: './plugin.component.html',
  styleUrls: ['./plugin.component.scss'],
  imports: [RouterLink, ConfirmActionComponent, InlineButtonComponent, ReactiveFormsModule, PluginFormComponent, LoadingComponent]
})
export class PluginComponent implements OnChanges, HasChanges {
  css = 'plugin list-item';
  @HostBinding('attr.tabindex') tabIndex = 0;

  @ViewChildren('action')
  actionComponents?: QueryList<ActionComponent>;

  @Input()
  plugin!: Plugin;

  editForm: UntypedFormGroup;
  submitted = false;
  editing = false;
  viewSource = false;
  @HostBinding('class.deleted')
  deleted = false;
  serverError: string[] = [];
  configErrors: string[] = [];
  defaultsErrors: string[] = [];
  schemaErrors: string[] = [];
  saving?: Subscription;

  constructor(
    private mod: ModService,
    public admin: AdminService,
    public store: Store,
    private plugins: PluginService,
    private fb: UntypedFormBuilder,
  ) {
    this.editForm = pluginForm(fb);
  }

  saveChanges() {
    return !this.editing || !this.editForm.dirty;
  }

  init(): void {
    this.actionComponents?.forEach(c => c.reset());
    this.editForm.patchValue({
      ...this.plugin,
      config: this.plugin.config ? JSON.stringify(this.plugin.config, null, 2) : undefined,
      defaults: this.plugin.defaults ? JSON.stringify(this.plugin.defaults, null, 2) : undefined,
      schema: this.plugin.schema ? JSON.stringify(this.plugin.schema, null, 2) : undefined,
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.plugin) {
      this.init();
    }
  }

  @HostBinding('class')
  get pluginClass() {
    return this.css + ' ' + this.plugin.tag
      .replace(/[+_]/g, '')
      .replace(/\//g, '_')
      .replace(/\./g, '-');
  }

  get created() {
    return !!this.plugin.modified;
  }

  get qualifiedTag() {
    return this.plugin.tag + this.origin;
  }

  get origin() {
    return this.plugin.origin || '';
  }

  get local() {
    return this.origin === this.store.account.origin;
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
    this.configErrors = [];
    this.defaultsErrors = [];
    this.schemaErrors = [];
    try {
      if (!plugin.config) delete plugin.config;
      if (plugin.config) plugin.config = JSON.parse(plugin.config);
    } catch (e: any) {
      this.configErrors.push(e.message);
    }
    try {
      if (!plugin.defaults) delete plugin.defaults;
      if (plugin.defaults) plugin.defaults = JSON.parse(plugin.defaults);
    } catch (e: any) {
      this.defaultsErrors.push(e.message);
    }
    try {
      if (!plugin.schema) delete plugin.schema;
      if (plugin.schema) plugin.schema = JSON.parse(plugin.schema);
    } catch (e: any) {
      this.schemaErrors.push(e.message);
    }
    if (this.configErrors.length || this.defaultsErrors.length || this.schemaErrors.length) return;
    this.saving = this.plugins.update(plugin).pipe(
      switchMap(() => this.plugins.get(this.qualifiedTag)),
      catchError((err: HttpErrorResponse) => {
        delete this.saving;
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(tag => {
      delete this.saving;
      this.editForm.reset();
      this.serverError = [];
      this.editing = false;
      this.plugin = tag;
    });
  }

  copy$ = () => {
    return this.plugins.create({
      ...this.plugin,
      origin: this.store.account.origin,
    }).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    );
  }

  delete$ = () => {
    const deleteNotice = !isDeletorTag(this.plugin.tag) && this.admin.getPlugin('plugin/delete')
      ? this.plugins.create(tagDeleteNotice(this.plugin))
      : of(null);
    return this.plugins.delete(this.qualifiedTag).pipe(
      switchMap(() => deleteNotice),
      tap(() => {
        this.serverError = [];
        this.deleted = true;
      }),
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    );
  }

  download = () => {
    downloadTag(writePlugin(this.plugin));
  }

  export() {
    downloadPluginExport(this.plugin, this.mod.exportHtml(this.plugin));
  }
}
