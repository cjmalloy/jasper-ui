import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { forOwn, mapValues } from 'lodash-es';
import { catchError, concat, last, Observable, retry, throwError, toArray } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Plugin } from '../../../model/plugin';
import { Template } from '../../../model/template';
import { AdminService } from '../../../service/admin.service';
import { PluginService } from '../../../service/api/plugin.service';
import { TemplateService } from '../../../service/api/template.service';
import { ThemeService } from '../../../service/theme.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { configGroups, modId } from '../../../util/format';
import { printError } from '../../../util/http';
import { Config } from '../../../model/tag';

@Component({
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
    private theme: ThemeService,
    public store: Store,
    private plugins: PluginService,
    private templates: TemplateService,
    private fb: UntypedFormBuilder,
  ) {
    theme.setTitle($localize`Settings: Setup`);
    this.adminForm = fb.group({
      mods: fb.group(mapValues({...this.admin.def.plugins, ...this.admin.def.templates }, p => fb.control(false))),
    });
    this.reset();
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
    const installs: Observable<any>[] = [];
    for (const plugin in this.admin.status.plugins) {
      const def = this.admin.def.plugins[plugin];
      const status = this.admin.status.plugins[plugin]!;
      if (!!status === !!this.adminForm.value.mods[plugin]) continue;
      if (this.adminForm.value.mods[plugin]) {
        installs.push(this.installPlugin$(def));
      } else {
        installs.push(this.deletePlugin$(status));
      }
    }
    for (const template in this.admin.status.templates) {
      const def = this.admin.def.templates[template];
      const status = this.admin.status.templates[template]!;
      if (!!status === !!this.adminForm.value.mods[template]) continue;
      if (this.adminForm.value.mods[template]) {
        installs.push(this.installTemplate$(def));
      } else {
        installs.push(this.deleteTemplate$(status));
      }
    }
    concat(...installs).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).pipe(last()).subscribe(() => {
      this.submitted = true;
      this.reset();
      this.installMessages.push($localize`Success.`);
    });
  }

  reset() {
    this.admin.init$.subscribe(() => this.adminForm.reset({ mods: { ...this.admin.status.plugins, ...this.admin.status.templates } }));
  }

  installPlugin$(def: Plugin, mod = false) {
    if (!mod && def.config?.mod) return this.installMod$(def.config?.mod);
    this.installMessages.push($localize`Installing ${def.name || def.tag} plugin...`);
    return this.plugins.create({
      ...def,
      origin: this.store.account.origin,
    }).pipe(retry(10));
  }

  deletePlugin$(status: Plugin, mod = false) {
    if (!mod && status.config?.mod) return this.deleteMod$(status.config?.mod);
    this.installMessages.push($localize`Deleting ${status.name || status.tag} plugin...`);
    return this.plugins.delete(status.tag + (status.origin || ''));
  }

  installTemplate$(def: Template, mod = false) {
    if (!mod && def.config?.mod) return this.installMod$(def.config?.mod);
    this.installMessages.push($localize`Installing ${def.name || def.tag} template...`);
    return this.templates.create({
      ...def,
      origin: this.store.account.origin,
    }).pipe(retry(10));
  }

  deleteTemplate$(status: Template, mod = false) {
    if (!mod && status.config?.mod) return this.deleteMod$(status.config?.mod);
    this.installMessages.push($localize`Deleting ${status.name || status.tag} template...`);
    return this.templates.delete(status.tag + (status.origin || ''));
  }

  installMod$(mod: string): Observable<any> {
    this.installMessages.push($localize`Installing ${mod} mod...`);
    return concat(...[
      ...Object.values(this.admin.def.plugins)
        .filter(p => modId(p) === mod)
        .map(p => this.installPlugin$(p, true)),
      ...Object.values(this.admin.def.templates)
        .filter(t => modId(t) === mod)
        .map(t => this.installTemplate$(t, true)),
    ]).pipe(toArray());
  }

  deleteMod$(mod: string): Observable<any> {
    this.installMessages.push($localize`Deleting ${mod} mod...`);
    return concat(...[
      ...Object.values(this.admin.def.plugins)
        .filter(p => modId(p) === mod)
        .map(p => this.deletePlugin$(p, true)),
      ...Object.values(this.admin.def.templates)
        .filter(t => modId(t) === mod)
        .map(t => this.deleteTemplate$(t, true)),
    ]).pipe(toArray());
  }

  updateAll() {
    const updates = [];
    for (const plugin in this.admin.status.plugins) {
      if (this.needsPluginUpdate(plugin)) updates.push(this.updatePlugin$(plugin, true));
    }
    for (const template in this.admin.status.templates) {
      if (this.needsTemplateUpdate(template)) updates.push(this.updateTemplate$(template, true));
    }
    concat(...updates).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).pipe(last()).subscribe(() => {
      this.submitted = true;
      this.reset();
      this.installMessages.push($localize`Success.`);
    });
  }

  selectAll() {
    this.selectAllToggle = !this.selectAllToggle;
    const sa = (fg: UntypedFormGroup) => forOwn(fg.controls, c => c.setValue(this.selectAllToggle));
    sa(this.adminForm.get('mods') as UntypedFormGroup);
  }

  updateMod(config: Config) {
    this.updateMod$(modId(config)).subscribe(() => this.reset());
  }

  updatePlugin$(key: string, mod = false) {
    const def = this.admin.def.plugins[key];
    if (!mod && def.config?.mod) return this.updateMod$(def.config?.mod);
    const status = this.admin.status.plugins[key]!;
    this.installMessages.push($localize`Updating ${def.name || def.tag} plugin...`);
    return this.plugins.update({
      ...def,
      defaults: {
        ...def.defaults || {},
        ...status.defaults || {},
      },
      origin: this.store.account.origin,
      modifiedString: status.modifiedString,
    }).pipe(
      tap(() => this.installMessages.push($localize`Updated ${def.name || def.tag} plugin.`))
    );
  }

  updateTemplate$(key: string, mod = false) {
    const def = this.admin.def.templates[key];
    if (!mod && def.config?.mod) return this.updateMod$(def.config?.mod);
    const status = this.admin.status.templates[key]!;
    this.installMessages.push($localize`Updating ${def.name || def.tag} template...`);
    return this.templates.update({
      ...def,
      defaults: {
        ...def.defaults || {},
        ...status.defaults || {},
      },
      origin: this.store.account.origin,
      modifiedString: status.modifiedString,
    }).pipe(
      tap(() => this.installMessages.push($localize`Updated ${def.name || def.tag} template.`)),
    );
  }

  updateMod$(mod: string): Observable<any> {
    this.installMessages.push($localize`Updating ${mod} mod...`);
    return concat(...[
      ...Object.values(this.admin.def.plugins)
        .filter(p => modId(p) === mod)
        .map(p => this.updatePlugin$(this.admin.keyOf(this.admin.def.plugins, p.tag), true)),
      ...Object.values(this.admin.def.templates)
        .filter(t => modId(t) === mod)
        .map(t => this.updateTemplate$(this.admin.keyOf(this.admin.def.templates, t.tag), true)),
    ]).pipe(toArray());
  }

  needsPluginUpdate(key: string) {
    return this.admin.status.plugins[key]?.config?.needsUpdate;
  }

  needsTemplateUpdate(key: string) {
    return this.admin.status.templates[key]?.config?.needsUpdate;
  }

  needsModUpdate(config: Config) {
    const mod = modId(config);
    return Object.values(this.admin.status.plugins).find(p => p && mod === modId(p) && p.config?.needsUpdate) ||
      Object.values(this.admin.status.templates).find(t => t && mod === modId(t) && t.config?.needsUpdate);
  }

}
