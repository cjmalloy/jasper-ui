import { HttpErrorResponse } from '@angular/common/http';
import { FakeLinkDirective } from '../../directive/fake-link.directive';
import { computed, Component, effect, input, linkedSignal, signal, untracked, viewChild, viewChildren, inject } from '@angular/core';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of, Subscription, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { pluginForm, PluginFormComponent } from '../../form/plugin/plugin.component';
import { DiffComponent } from '../../form/diff/diff.component';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Plugin, writePlugin } from '../../model/plugin';
import { isDeletorTag, tagDeleteNotice } from '../../mods/delete';
import { AdminService } from '../../service/admin.service';
import { PluginService } from '../../service/api/plugin.service';
import { ModService } from '../../service/mod.service';
import { Store } from '../../store/store';
import { downloadPluginExport, downloadTag } from '../../util/download';
import { scrollToFirstInvalid, controlState } from '../../util/form';
import { printError } from '../../util/http';
import { ConfirmActionComponent } from '../action/confirm-action/confirm-action.component';
import { InlineButtonComponent } from '../action/inline-button/inline-button.component';
import { LoadingComponent } from '../loading/loading.component';
import { RelativePipe } from '../../pipe/relative.pipe';

@Component({
  selector: 'app-plugin',
  templateUrl: './plugin.component.html',
  styleUrls: ['./plugin.component.scss'],
  imports: [
    RelativePipe,FakeLinkDirective, RouterLink, ConfirmActionComponent, InlineButtonComponent, ReactiveFormsModule, PluginFormComponent, LoadingComponent, DiffComponent],
  host: {
    '[attr.tabindex]': '0',
    '[class.deleted]': 'deleted()',
    '[class]': "pluginClass()",
  },
})
export class PluginComponent implements HasChanges {
  private mod = inject(ModService);
  admin = inject(AdminService);
  store = inject(Store);
  private plugins = inject(PluginService);
  private fb = inject(UntypedFormBuilder);

  css = 'plugin list-item';


  readonly pluginInput = input<Plugin>({} as Plugin, { alias: 'plugin' });
  readonly plugin = linkedSignal(() => this.pluginInput());
  readonly deleted = linkedSignal(() => { this.plugin(); return false; });
  readonly serverError = linkedSignal<string[]>(() => { this.plugin(); return []; });
  readonly configErrors = linkedSignal<string[]>(() => { this.plugin(); return []; });
  readonly defaultsErrors = linkedSignal<string[]>(() => { this.plugin(); return []; });
  readonly schemaErrors = linkedSignal<string[]>(() => { this.plugin(); return []; });
  readonly saving = signal(false);
  private savingSubscription?: Subscription;

  editForm: UntypedFormGroup;
  protected readonly editFormValid = controlState(() => this.editForm, c => c.valid);
  protected readonly editFormDirty = controlState(() => this.editForm, c => c.dirty);
  readonly submitted = linkedSignal(() => { this.plugin(); return false; });
  readonly editing = linkedSignal(() => { this.plugin(); return false; });
  readonly viewSource = linkedSignal(() => { this.plugin(); return false; });
  readonly diffing = linkedSignal(() => { this.plugin(); return false; });
  readonly diffLocal = signal<Plugin | undefined>(undefined);
  readonly diffRemote = signal<Plugin | undefined>(undefined);
  private loadingDiff?: Subscription;

  readonly diffEditor = viewChild<DiffComponent<Plugin>>('diffEditor');

  constructor() {
    const fb = this.fb;

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
    this.editForm.patchValue({
      ...this.plugin(),
      config: this.plugin().config ? JSON.stringify(this.plugin().config, null, 2) : undefined,
      defaults: this.plugin().defaults ? JSON.stringify(this.plugin().defaults, null, 2) : undefined,
      schema: this.plugin().schema ? JSON.stringify(this.plugin().schema, null, 2) : undefined,
    });
  }

  readonly pluginClass = computed(() => {
    return this.css + ' ' + (this.plugin().tag || '')
      .replace(/[+_]/g, '')
      .replace(/\//g, '_')
      .replace(/\./g, '-');
  });

  readonly created = computed(() => {
    return !!this.plugin().modified;
  });

  readonly qualifiedTag = computed(() => {
    return this.plugin().tag + this.origin();
  });

  readonly origin = computed(() => {
    return this.plugin().origin || '';
  });

  readonly local = computed(() => {
    return this.origin() === this.store.account.origin();
  });

  readonly canDiff = computed(() => {
    return !this.local() && this.created() && !!this.admin.getTemplate('config/diff');
  });

  toggleDiff() {
    if (this.diffing() || this.loadingDiff) {
      this.loadingDiff?.unsubscribe();
      delete this.loadingDiff;
      this.diffing.set(false);
      return;
    }
    this.serverError.set([]);
    this.viewSource.set(false);
    this.loadingDiff = this.plugins.get(this.plugin().tag + this.store.account.origin()).pipe(
      catchError((err: HttpErrorResponse) => {
        delete this.loadingDiff;
        this.serverError.set(err.status === 404
          ? [$localize`No local version found.`]
          : printError(err));
        return throwError(() => err);
      }),
    ).subscribe(local => {
      delete this.loadingDiff;
      this.diffLocal.set(local);
      this.diffRemote.set(this.plugin());
      this.editing.set(false);
      this.viewSource.set(false);
      this.diffing.set(true);
    });
  }

  saveDiff() {
    const merged = this.diffEditor()?.getModifiedContent();
    const local = this.diffLocal();
    if (!merged || !local) return;
    this.saving.set(true);
    this.savingSubscription = this.plugins.update({
      ...merged,
      tag: local.tag,
      origin: this.store.account.origin(),
      modifiedString: local.modifiedString,
    }).pipe(
      catchError((err: HttpErrorResponse) => {
        this.saving.set(false);
        this.serverError.set(printError(err));
        return throwError(() => err);
      }),
    ).subscribe(() => {
      this.saving.set(false);
      this.serverError.set([]);
      this.diffing.set(false);
    });
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
    this.saving.set(true);
    this.savingSubscription = this.plugins.update(plugin).pipe(
      switchMap(() => this.plugins.get(this.qualifiedTag())),
      catchError((err: HttpErrorResponse) => {
        this.saving.set(false);
        this.serverError.set(printError(err));
        return throwError(() => err);
      }),
    ).subscribe(tag => {
      this.saving.set(false);
      this.editForm.reset();
      this.serverError.set([]);
      this.editing.set(false);
      this.plugin.set(tag);
    });
    this.savingSubscription?.add(() => this.saving.set(false));
  }

  copy$ = () => {
    return this.plugins.create({
      ...this.plugin(),
      origin: this.store.account.origin(),
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
    return this.plugins.delete(this.qualifiedTag()).pipe(
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
