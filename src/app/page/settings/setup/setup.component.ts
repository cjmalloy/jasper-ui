import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { forOwn, mapValues, uniq } from 'lodash-es';
import { catchError, concat, last, Observable, of, retry, switchMap, throwError, toArray } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Plugin } from '../../../model/plugin';
import { Config } from '../../../model/tag';
import { Template } from '../../../model/template';
import { tagDeleteNotice } from '../../../mods/delete';
import { AdminService } from '../../../service/admin.service';
import { PluginService } from '../../../service/api/plugin.service';
import { TemplateService } from '../../../service/api/template.service';
import { ModService } from '../../../service/mod.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { configGroups, modId } from '../../../util/format';
import { printError } from '../../../util/http';

@Component({
  standalone: false,
  selector: 'app-settings-setup-page',
  templateUrl: './setup.component.html',
  styleUrls: ['./setup.component.scss'],
})
export class SettingsSetupPage implements OnInit {

  experiments = !!this.admin.getTemplate('experiments');
  selectAllToggle = false;
  submitted = false;
  adminForm: UntypedFormGroup;
  serverError: string[] = [];
  installMessages: string[] = [];
  modGroups = configGroups({...this.admin.def.plugins, ...this.admin.def.templates });

  constructor(
    public admin: AdminService,
    private mod: ModService,
    public store: Store,
    private plugins: PluginService,
    private templates: TemplateService,
    private fb: UntypedFormBuilder,
  ) {
    mod.setTitle($localize`Settings: Setup`);
    this.adminForm = fb.group({
      mods: fb.group(mapValues({...this.admin.def.plugins, ...this.admin.def.templates }, p => fb.control(false))),
    });
    this.clear();
  }

  ngOnInit(): void {
  }

  install() {
    this.serverError = [];
    this.installMessages = [];
    this.submitted = true;
    this.adminForm.markAllAsTouched();
    if (!this.adminForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const deletes: string[] = [];
    const installs: string[] = [];
    for (const plugin in this.admin.status.plugins) {
      const def = this.admin.def.plugins[plugin];
      if (!def) continue;
      const status = this.admin.status.plugins[plugin] || this.admin.status.disabledPlugins[plugin];
      if (!!status === !!this.adminForm.value.mods[plugin]) continue;
      if (this.adminForm.value.mods[plugin]) {
        installs.push(modId(def));
      } else {
        deletes.push(modId(status));
      }
    }
    for (const template in this.admin.status.templates) {
      const def = this.admin.def.templates[template];
      if (!def) continue;
      const status = this.admin.status.templates[template] || this.admin.status.disabledTemplates[template];
      if (!!status === !!this.adminForm.value.mods[template]) continue;
      if (this.adminForm.value.mods[template]) {
        installs.push(modId(def));
      } else {
        deletes.push(modId(status));
      }
    }
    const _ = (msg: string) => this.installMessages.push(msg);
    concat(
        ...uniq(deletes).map(m => this.admin.deleteMod$(m, _)),
        ...uniq(installs).map(m => this.admin.installMod$(m, _))
    ).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
      last(),
    ).subscribe(() => {
      this.submitted = true;
      this.reset();
      _($localize`Success.`);
    });
  }

  reset() {
    this.admin.init$.subscribe(() => this.clear());
  }

  clear() {
    this.adminForm.reset({ mods: {
      ...this.admin.status.plugins,
      ...this.admin.status.disabledPlugins,
      ...this.admin.status.templates,
      ...this.admin.status.disabledTemplates,
    }});
  }

  updateAll() {
    const _ = (msg: string) => this.installMessages.push(msg);
    const updates = [];
    for (const plugin in this.admin.status.plugins) {
      const status = this.admin.status.plugins[plugin];
      if (this.needsUpdate(status)) updates.push(this.admin.updateMod$(modId(status), _));
    }
    for (const template in this.admin.status.templates) {
      const status = this.admin.status.templates[template];
      if (this.needsUpdate(status)) updates.push(this.admin.updateMod$(modId(status), _));
    }
    concat(...updates).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).pipe(last()).subscribe(() => {
      this.submitted = true;
      this.reset();
      _($localize`Success.`);
    });
  }

  selectAll() {
    this.selectAllToggle = !this.selectAllToggle;
    const sa = (fg: UntypedFormGroup) => forOwn(fg.controls, c => c.setValue(this.selectAllToggle));
    sa(this.adminForm.get('mods') as UntypedFormGroup);
  }

  updateMod(config: Config) {
    const _ = (msg: string) => this.installMessages.push(msg);
    this.admin.updateMod$(modId(config), _).subscribe(() => this.reset());
  }

  needsUpdate(mod?: Config) {
    return mod?.config?.needsUpdate;
  }

  needsModUpdate(config: Config) {
    const mod = modId(config);
    return Object.values(this.admin.status.plugins).find(p => p && mod === modId(p) && p.config?.needsUpdate) ||
      Object.values(this.admin.status.templates).find(t => t && mod === modId(t) && t.config?.needsUpdate);
  }

  disabled(config: Config) {
    const mod = modId(config);
    return Object.values(this.admin.status.disabledPlugins).find(p => p && mod === modId(p)) ||
      Object.values(this.admin.status.disabledTemplates).find(t => t && mod === modId(t));
  }

  modLabel(name: string) {
    return name.replace(/\W/g, '').toLowerCase();
  }
}
