import { HttpErrorResponse } from '@angular/common/http';
import { FakeLinkDirective } from '../../directive/fake-link.directive';
import { ChangeDetectionStrategy, Component, effect, input, linkedSignal, signal, untracked, viewChildren } from '@angular/core';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of, Subscription, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { pluginForm, PluginFormComponent } from '../../form/plugin/plugin.component';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Plugin, writePlugin } from '../../model/plugin';
import { isDeletorTag, tagDeleteNotice } from '../../mods/delete';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FakeLinkDirective, RouterLink, ConfirmActionComponent, InlineButtonComponent, ReactiveFormsModule, PluginFormComponent, LoadingComponent],
  host: {
    '[attr.tabindex]': '0',
    '[class.deleted]': 'deleted()',
    '[class]': 'pluginClass',
  },
})
export class PluginComponent implements HasChanges {
  css = 'plugin list-item';

  readonly actionComponents = viewChildren<ActionComponent>('action');

  readonly pluginInput = input<Plugin>({} as Plugin, { alias: 'plugin' });
  readonly plugin = linkedSignal(() => this.pluginInput());
  readonly deleted = signal(false);
  readonly serverError = signal<string[]>([]);
  readonly configErrors = signal<string[]>([]);
  readonly defaultsErrors = signal<string[]>([]);
  readonly schemaErrors = signal<string[]>([]);
  readonly saving = signal<Subscription | undefined>(undefined);

  editForm: UntypedFormGroup;
  readonly submitted = signal(false);
  readonly editing = signal(false);
  viewSource = false;

  constructor(
    private mod: ModService,
    public admin: AdminService,
    public store: Store,
    private plugins: PluginService,
    private fb: UntypedFormBuilder,
  ) {
    this.editForm = pluginForm(fb);
    effect(() => {
      this.pluginInput();
      untracked(() => this.init());
    });
  }

  saveChanges() {
    return !this.editing() || !this.editForm.dirty;
  }

  init(): void {
    this.actionComponents()?.forEach(c => c.reset());
    this.editForm.patchValue({
      ...this.plugin(),
      config: this.plugin().config ? JSON.stringify(this.plugin().config, null, 2) : undefined,
      defaults: this.plugin().defaults ? JSON.stringify(this.plugin().defaults, null, 2) : undefined,
      schema: this.plugin().schema ? JSON.stringify(this.plugin().schema, null, 2) : undefined,
    });
  }

  get pluginClass() {
    return this.css + ' ' + (this.plugin().tag || '')
      .replace(/[+_]/g, '')
      .replace(/\//g, '_')
      .replace(/\./g, '-');
  }

  get created() {
    return !!this.plugin().modified;
  }

  get qualifiedTag() {
    return this.plugin().tag + this.origin;
  }

  get origin() {
    return this.plugin().origin || '';
  }

  get local() {
    return this.origin === this.store.account.origin;
  }

  save() {
    this.submitted.set(true);
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const plugin = {
      ...this.plugin(),
      ...this.editForm.value,
    };
    this.configErrors.set([]);
    this.defaultsErrors.set([]);
    this.schemaErrors.set([]);
    try {
      if (!plugin.config) delete plugin.config;
      if (plugin.config) plugin.config = JSON.parse(plugin.config);
    } catch (e: any) {
      this.configErrors.update(configErrors => [...configErrors, e.message]);
    }
    try {
      if (!plugin.defaults) delete plugin.defaults;
      if (plugin.defaults) plugin.defaults = JSON.parse(plugin.defaults);
    } catch (e: any) {
      this.defaultsErrors.update(defaultsErrors => [...defaultsErrors, e.message]);
    }
    try {
      if (!plugin.schema) delete plugin.schema;
      if (plugin.schema) plugin.schema = JSON.parse(plugin.schema);
    } catch (e: any) {
      this.schemaErrors.update(schemaErrors => [...schemaErrors, e.message]);
    }
    if (this.configErrors().length || this.defaultsErrors().length || this.schemaErrors().length) return;
    this.saving.set(this.plugins.update(plugin).pipe(
      switchMap(() => this.plugins.get(this.qualifiedTag)),
      catchError((err: HttpErrorResponse) => {
        this.saving.set(undefined);
        this.serverError.set(printError(err));
        return throwError(() => err);
      }),
    ).subscribe(tag => {
      this.saving.set(undefined);
      this.editForm.reset();
      this.serverError.set([]);
      this.editing.set(false);
      this.plugin.set(tag);
    }));
  }

  copy$ = () => {
    return this.plugins.create({
      ...this.plugin(),
      origin: this.store.account.origin,
    }).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError.set(printError(err));
        return throwError(() => err);
      }),
    );
  }

  delete$ = () => {
    const deleteNotice = !isDeletorTag(this.plugin().tag) && this.admin.getPlugin('plugin/delete')
      ? this.plugins.create(tagDeleteNotice(this.plugin()))
      : of(null);
    return this.plugins.delete(this.qualifiedTag).pipe(
      switchMap(() => deleteNotice),
      tap(() => {
        this.serverError.set([]);
        this.deleted.set(true);
      }),
      catchError((err: HttpErrorResponse) => {
        this.serverError.set(printError(err));
        return throwError(() => err);
      }),
    );
  }

  download = () => {
    downloadTag(writePlugin(this.plugin()));
  }

  export() {
    downloadPluginExport(this.plugin(), this.mod.exportHtml(this.plugin()));
  }
}
