import { HttpErrorResponse } from '@angular/common/http';
import { FakeLinkDirective } from '../../directive/fake-link.directive';
import { ChangeDetectionStrategy, Component, effect, input, linkedSignal, signal, untracked, viewChildren } from '@angular/core';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of, Subscription, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { templateForm, TemplateFormComponent } from '../../form/template/template.component';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Template, writeTemplate } from '../../model/template';
import { isDeletorTag, tagDeleteNotice } from '../../mods/delete';
import { AdminService } from '../../service/admin.service';
import { TemplateService } from '../../service/api/template.service';
import { Store } from '../../store/store';
import { downloadTag } from '../../util/download';
import { scrollToFirstInvalid } from '../../util/form';
import { printError } from '../../util/http';
import { ActionComponent } from '../action/action.component';
import { ConfirmActionComponent } from '../action/confirm-action/confirm-action.component';
import { InlineButtonComponent } from '../action/inline-button/inline-button.component';
import { LoadingComponent } from '../loading/loading.component';

@Component({
  selector: 'app-template',
  templateUrl: './template.component.html',
  styleUrls: ['./template.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FakeLinkDirective, RouterLink, ConfirmActionComponent, InlineButtonComponent, ReactiveFormsModule, TemplateFormComponent, LoadingComponent],
  host: {
    '[attr.tabindex]': '0',
    '[class.deleted]': 'deleted()',
    '[class]': 'pluginClass',
  },
})
export class TemplateComponent implements HasChanges {
  css = 'template list-item';

  readonly actionComponents = viewChildren<ActionComponent>('action');

  readonly templateInput = input<Template>({} as Template, { alias: 'template' });
  readonly template = linkedSignal(() => this.templateInput());
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
    public admin: AdminService,
    public store: Store,
    private templates: TemplateService,
    private fb: UntypedFormBuilder,
  ) {
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
    this.actionComponents()?.forEach(c => c.reset());
    this.editForm.patchValue({
      ...this.template(),
      config: this.template().config ? JSON.stringify(this.template().config, null, 2) : undefined,
      defaults: this.template().defaults ? JSON.stringify(this.template().defaults, null, 2) : undefined,
      schema: this.template().schema ? JSON.stringify(this.template().schema, null, 2) : undefined,
    });
  }

  get pluginClass() {
    return this.css + ' ' + (this.template().tag || '')
      .replace(/[+_]/g, '')
      .replace(/\//g, '_')
      .replace(/\./g, '-');
  }

  get created() {
    return !!this.template().modified;
  }

  get qualifiedTag() {
    return this.template().tag + this.origin;
  }

  get origin() {
    return this.template().origin || '';
  }

  get local() {
    return this.origin === this.store.account.origin();
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
    this.saving.set(this.templates.update(template).pipe(
      switchMap(() => this.templates.get(this.qualifiedTag)),
      catchError((err: HttpErrorResponse) => {
        this.saving.set(undefined);
        this.serverError.set(printError(err));
        return throwError(() => err);
      }),
    ).subscribe(template => {
      this.saving.set(undefined);
      this.editForm.reset();
      this.serverError.set([]);
      this.editing.set(false);
      this.template.set(template);
    }));
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
    return this.templates.delete(this.qualifiedTag).pipe(
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
