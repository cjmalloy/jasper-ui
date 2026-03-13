import { KeyValuePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forOwn, uniq } from 'lodash-es';
import { concat, last } from 'rxjs';
import { Config, Mod } from '../../../model/tag';
import { AdminService, ModUpdatePreview } from '../../../service/admin.service';
import { ModService } from '../../../service/mod.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { configGroups, formSafeNames, modId } from '../../../util/format';
import { printError } from '../../../util/http';
import { DiffComponent } from '../../../form/diff/diff.component';

@Component({
  selector: 'app-settings-setup-page',
  templateUrl: './setup.component.html',
  styleUrls: ['./setup.component.scss'],
  imports: [
    ReactiveFormsModule,
    RouterLink,
    KeyValuePipe,
    DiffComponent,
  ],
})
export class SettingsSetupPage {

  experiments = !!this.admin.getTemplate('config/experiments');
  selectAllToggle = false;
  submitted = false;
  adminForm: UntypedFormGroup;
  serverError: string[] = [];
  installMessages: string[] = [];
  mergeState?: ModUpdatePreview;
  modGroups = configGroups({
    ...this.admin.status.disabledPlugins, ...this.admin.status.disabledTemplates,
    ...this.admin.status.plugins, ...this.admin.status.templates,
    ...this.admin.def.plugins, ...this.admin.def.templates });

  constructor(
    public admin: AdminService,
    private mod: ModService,
    public store: Store,
    private fb: UntypedFormBuilder,
  ) {
    mod.setTitle($localize`Settings: Setup`);
    this.adminForm = fb.group({
      mods: fb.group(formSafeNames({...this.admin.def.plugins, ...this.admin.def.templates })),
    });
    this.clear();
  }

  install() {
    this.serverError = [];
    this.installMessages = [];
    this.mergeState = undefined;
    this.submitted = true;
    this.adminForm.markAllAsTouched();
    if (!this.adminForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const deletes: string[] = [];
    const installs: string[] = [];
    for (const plugin in this.admin.def.plugins) {
      const formName = plugin.replace(/[.]/g, '-');
      const def = this.admin.def.plugins[plugin];
      const status = this.admin.status.plugins[plugin] || this.admin.status.disabledPlugins[plugin];
      if (!!status === !!this.adminForm.value.mods[formName]) continue;
      if (this.adminForm.value.mods[formName]) {
        installs.push(modId(def));
      } else {
        deletes.push(modId(status));
      }
    }
    for (const template in this.admin.def.templates) {
      const formName = template.replace(/[.]/g, '-');
      const def = this.admin.def.templates[template];
      const status = this.admin.status.templates[template] || this.admin.status.disabledTemplates[template];
      if (!!status === !!this.adminForm.value.mods[formName]) continue;
      if (this.adminForm.value.mods[formName]) {
        installs.push(modId(def));
      } else {
        deletes.push(modId(status));
      }
    }
    const _ = (msg?: string) => this.installMessages.push(msg!);
    if (!deletes.length && !installs.length) {
      this.submitted = true;
      _($localize`Success.`);
      return;
    }
    concat(
      ...uniq(deletes).map(m => this.admin.deleteMod$(m, _)),
      ...uniq(installs).map(m => this.admin.installMod$(m, _))
    ).pipe(
      last(),
    ).subscribe({
      next: () => {
        this.submitted = true;
        this.reset();
        _($localize`Success.`);
      },
      error: (res: HttpErrorResponse) => this.serverError = printError(res),
    });
  }

  reset() {
    this.mergeState = undefined;
    this.admin.init$.subscribe(() => this.clear());
  }

  clear() {
    this.adminForm.reset({
      mods: formSafeNames({
        ...this.admin.status.plugins,
        ...this.admin.status.disabledPlugins,
        ...this.admin.status.templates,
        ...this.admin.status.disabledTemplates,
      }),
    });
  }

  updateAll() {
    this.serverError = [];
    this.mergeState = undefined;
    const _ = (msg?: string) => this.installMessages.push(msg!);
    const mods: string[] = [];
    for (const plugin in this.admin.status.plugins) {
      const status = this.admin.status.plugins[plugin];
      if (this.needsUpdate(status)) mods.push(modId(status));
    }
    for (const template in this.admin.status.templates) {
      const status = this.admin.status.templates[template];
      if (this.needsUpdate(status)) mods.push(modId(status));
    }
    concat(...uniq(mods).map(mod => this.admin.updateMod$(mod, _)))
      .pipe(last())
      .subscribe(
        () => {
          this.submitted = true;
          this.reset();
          _($localize`Success.`);
        },
        (res: HttpErrorResponse | { preview?: ModUpdatePreview }) => this.handleUpdateError(res),
      );
  }

  selectAll() {
    this.selectAllToggle = !this.selectAllToggle;
    const sa = (fg: UntypedFormGroup) => forOwn(fg.controls, c => c.setValue(this.selectAllToggle));
    sa(this.adminForm.get('mods') as UntypedFormGroup);
  }

  updateMod(config: Config) {
    this.serverError = [];
    this.mergeState = undefined;
    const _ = (msg?: string) => this.installMessages.push(msg!);
    this.admin.updateMod$(modId(config), _).subscribe(
      () => this.reset(),
      (res: HttpErrorResponse | { preview?: ModUpdatePreview }) => this.handleUpdateError(res),
    );
  }

  diffMod(config: Config) {
    this.serverError = [];
    this.mergeState = this.admin.getModUpdatePreview(modId(config), true);
  }

  applyMerge(bundle: Mod | null | undefined) {
    if (!this.mergeState || !bundle) return;
    this.serverError = [];
    const _ = (msg?: string) => this.installMessages.push(msg!);
    this.admin.applyModUpdate$(this.mergeState.mod, bundle, this.mergeState.target, _).subscribe(
      () => {
        this.mergeState = undefined;
        this.reset();
        _($localize`Success.`);
      },
      (res: HttpErrorResponse) => this.serverError = printError(res),
    );
  }

  overwriteMerge() {
    this.applyMerge(this.mergeState?.target);
  }

  cancelMerge() {
    this.mergeState = undefined;
  }

  needsUpdate(mod?: Config) {
    return mod?.config?.needsUpdate;
  }

  needsModUpdate(config: Config) {
    const mod = modId(config);
    return Object.values(this.admin.status.plugins).find(p => p && mod === modId(p) && p.config?.needsUpdate) ||
      Object.values(this.admin.status.templates).find(t => t && mod === modId(t) && t.config?.needsUpdate);
  }

  modModified(config: Config) {
    return this.admin.isModModified(modId(config));
  }

  installed(config: Config) {
    const mod = modId(config);
    return Object.values(this.admin.status.plugins).find(p => p && mod === modId(p)) ||
      Object.values(this.admin.status.templates).find(t => t && mod === modId(t));
  }

  disabled(config: Config) {
    const mod = modId(config);
    return Object.values(this.admin.status.disabledPlugins).find(p => p && mod === modId(p)) ||
      Object.values(this.admin.status.disabledTemplates).find(t => t && mod === modId(t));
  }

  modLabel([tag, e]: [string, Config]) {
    return (e.config?.mod?.replace(/\W/g, '') || tag).toLowerCase();
  }

  private handleUpdateError(res: HttpErrorResponse | { preview?: ModUpdatePreview }) {
    if ('preview' in res && res.preview) {
      this.mergeState = res.preview;
      return;
    }
    this.serverError = printError(res as HttpErrorResponse);
  }
}
