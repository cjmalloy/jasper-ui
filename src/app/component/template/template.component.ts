import { HttpErrorResponse } from '@angular/common/http';
import { FakeLinkDirective } from '../../directive/fake-link.directive';
import { computed, Component, effect, input, linkedSignal, signal, untracked, viewChild, viewChildren, inject } from '@angular/core';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of, Subscription, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { templateForm, TemplateFormComponent } from '../../form/template/template.component';
import { DiffComponent } from '../../form/diff/diff.component';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Template, writeTemplate } from '../../model/template';
import { isDeletorTag, tagDeleteNotice } from '../../mods/delete';
import { AdminService } from '../../service/admin.service';
import { TemplateService } from '../../service/api/template.service';
import { Store } from '../../store/store';
import { downloadTag } from '../../util/download';
import { scrollToFirstInvalid, controlState } from '../../util/form';
import { printError } from '../../util/http';
import { ConfirmActionComponent } from '../action/confirm-action/confirm-action.component';
import { InlineButtonComponent } from '../action/inline-button/inline-button.component';
import { LoadingComponent } from '../loading/loading.component';
import { RelativePipe } from '../../pipe/relative.pipe';

@Component({
  selector: 'app-template',
  templateUrl: './template.component.html',
  styleUrls: ['./template.component.scss'],
  imports: [
    RelativePipe,FakeLinkDirective, RouterLink, ConfirmActionComponent, InlineButtonComponent, ReactiveFormsModule, TemplateFormComponent, LoadingComponent, DiffComponent],
  host: {
    '[attr.tabindex]': '0',
    '[class.deleted]': 'deleted()',
    '[class]': "pluginClass()",
  },
})
export class TemplateComponent implements HasChanges {
  admin = inject(AdminService);
  store = inject(Store);
  private templates = inject(TemplateService);
  private fb = inject(UntypedFormBuilder);

  css = 'template list-item';


  readonly templateInput = input<Template>({} as Template, { alias: 'template' });
  readonly template = linkedSignal(() => this.templateInput());
  readonly deleted = linkedSignal(() => { this.template(); return false; });
  readonly serverError = linkedSignal<string[]>(() => { this.template(); return []; });
  readonly configErrors = linkedSignal<string[]>(() => { this.template(); return []; });
  readonly defaultsErrors = linkedSignal<string[]>(() => { this.template(); return []; });
  readonly schemaErrors = linkedSignal<string[]>(() => { this.template(); return []; });
  readonly saving = signal(false);
  private savingSubscription?: Subscription;

  editForm: UntypedFormGroup;
  protected readonly editFormValid = controlState(() => this.editForm, c => c.valid);
  protected readonly editFormDirty = controlState(() => this.editForm, c => c.dirty);
  readonly submitted = linkedSignal(() => { this.template(); return false; });
  readonly editing = linkedSignal(() => { this.template(); return false; });
  readonly viewSource = linkedSignal(() => { this.template(); return false; });
  readonly diffing = linkedSignal(() => { this.template(); return false; });
  readonly diffLocal = signal<Template | undefined>(undefined);
  readonly diffRemote = signal<Template | undefined>(undefined);
  private loadingDiff?: Subscription;

  readonly diffEditor = viewChild<DiffComponent<Template>>('diffEditor');

  constructor() {
    const fb = this.fb;

    this.editForm = templateForm(fb);
    effect(() => {
      this.templateInput();
      untracked(() => this.init());
    });
  }

  saveChanges() {
    return !this.editing() || !this.editForm.dirty;
  }

  init(): void {
    this.editForm.patchValue({
      ...this.template(),
      config: this.template().config ? JSON.stringify(this.template().config, null, 2) : undefined,
      defaults: this.template().defaults ? JSON.stringify(this.template().defaults, null, 2) : undefined,
      schema: this.template().schema ? JSON.stringify(this.template().schema, null, 2) : undefined,
    });
  }

  readonly pluginClass = computed(() => {
    return this.css + ' ' + (this.template().tag || '')
      .replace(/[+_]/g, '')
      .replace(/\//g, '_')
      .replace(/\./g, '-');
  });

  readonly created = computed(() => {
    return !!this.template().modified;
  });

  readonly qualifiedTag = computed(() => {
    return this.template().tag + this.origin();
  });

  readonly origin = computed(() => {
    return this.template().origin || '';
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
    this.loadingDiff = this.templates.get(this.template().tag + this.store.account.origin()).pipe(
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
      this.diffRemote.set(this.template());
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
    this.savingSubscription = this.templates.update({
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
    const template = {
      ...this.template(),
      ...this.editForm.value,
    };
    this.configErrors.set([]);
    this.defaultsErrors.set([]);
    this.schemaErrors.set([]);
    try {
      if (!template.config) delete template.config;
      if (template.config) template.config = JSON.parse(template.config);
    } catch (e: any) {
      this.configErrors.update(configErrors => [...configErrors, e.message]);
    }
    try {
      if (!template.defaults) delete template.defaults;
      if (template.defaults) template.defaults = JSON.parse(template.defaults);
    } catch (e: any) {
      this.defaultsErrors.update(defaultsErrors => [...defaultsErrors, e.message]);
    }
    try {
      if (!template.schema) delete template.schema;
      if (template.schema) template.schema = JSON.parse(template.schema);
    } catch (e: any) {
      this.schemaErrors.update(schemaErrors => [...schemaErrors, e.message]);
    }
    if (this.configErrors().length || this.defaultsErrors().length || this.schemaErrors().length) return;
    this.saving.set(true);
    this.savingSubscription = this.templates.update(template).pipe(
      switchMap(() => this.templates.get(this.qualifiedTag())),
      catchError((err: HttpErrorResponse) => {
        this.saving.set(false);
        this.serverError.set(printError(err));
        return throwError(() => err);
      }),
    ).subscribe(template => {
      this.saving.set(false);
      this.editForm.reset();
      this.serverError.set([]);
      this.editing.set(false);
      this.template.set(template);
    });
    this.savingSubscription?.add(() => this.saving.set(false));
  }

  copy$ = () => {
    return this.templates.create({
      ...this.template(),
      origin: this.store.account.origin(),
    }).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError.set(printError(err));
        return throwError(() => err);
      }),
    );
  }

  delete$ = () => {
    const deleteNotice = !isDeletorTag(this.template().tag) && this.admin.getPlugin('plugin/delete')
      ? this.templates.create(tagDeleteNotice(this.template()))
      : of(null);
    return this.templates.delete(this.qualifiedTag()).pipe(
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

  download() {
    downloadTag(writeTemplate(this.template()));
  }
}
