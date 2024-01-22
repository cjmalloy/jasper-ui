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
import { ThemeService } from '../../../service/theme.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { configGroups, modId } from '../../../util/format';
import { printError } from '../../../util/http';

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
      const status = this.admin.status.templates[template] || this.admin.status.disabledTemplates[template];
      if (!!status === !!this.adminForm.value.mods[template]) continue;
      if (this.adminForm.value.mods[template]) {
        installs.push(modId(def));
      } else {
        deletes.push(modId(status));
      }
    }
    concat(
        ...uniq(deletes).map(m => this.deleteMod$(m)),
        ...uniq(installs).map(m => this.installMod$(m))
    ).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
      last(),
    ).subscribe(() => {
      this.submitted = true;
      this.reset();
      this.installMessages.push($localize`Success.`);
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

  installPlugin$(def: Plugin) {
    this.installMessages.push('\u00A0'.repeat(4) + $localize`Installing ${def.name || def.tag} plugin...`);
    return this.plugins.delete(def.tag + this.store.account.origin).pipe(
      switchMap(() => this.plugins.create({ ...def, origin: this.store.account.origin })),
      retry(10),
    );
  }

  deletePlugin$(p: Plugin) {
    this.installMessages.push('\u00A0'.repeat(4) + $localize`Deleting ${p.name || p.tag} plugin...`);
    const deleteNotice = this.admin.getPlugin('plugin/delete')
      ? this.plugins.create(tagDeleteNotice(p))
      : of(null);
    return this.plugins.delete(p.tag + this.store.account.origin).pipe(
      switchMap(() => deleteNotice),
    );
  }

  installTemplate$(def: Template) {
    this.installMessages.push('\u00A0'.repeat(4) + $localize`Installing ${def.name || def.tag} template...`);
    return this.templates.delete(def.tag + this.store.account.origin).pipe(
      switchMap(() => this.templates.create({ ...def, origin: this.store.account.origin })),
      retry(10),
    );
  }

  deleteTemplate$(t: Template) {
    this.installMessages.push('\u00A0'.repeat(4) + $localize`Deleting ${t.name || t.tag} template...`);
    const deleteNotice = this.admin.getPlugin('plugin/delete')
      ? this.templates.create(tagDeleteNotice(t))
      : of(null);
    return this.templates.delete(t.tag + this.store.account.origin).pipe(
      switchMap(() => deleteNotice),
    );
  }

  installMod$(mod: string): Observable<any> {
    this.installMessages.push($localize`Installing ${mod} mod...`);
    return concat(...[
      ...Object.values(this.admin.def.plugins)
        .filter(p => modId(p) === mod)
        .map(p => this.installPlugin$(p)),
      ...Object.values(this.admin.def.templates)
        .filter(t => modId(t) === mod)
        .map(t => this.installTemplate$(t)),
    ]).pipe(toArray());
  }

  deleteMod$(mod: string): Observable<any> {
    this.installMessages.push($localize`Deleting ${mod} mod...`);
    return concat(...[
      ...Object.values(this.admin.status.plugins)
        .filter(p => modId(p) === mod)
        .map(p => this.deletePlugin$(p!)),
      ...Object.values(this.admin.status.templates)
        .filter(t => modId(t) === mod)
        .map(t => this.deleteTemplate$(t!)),
    ]).pipe(toArray());
  }

  updateAll() {
    const updates = [];
    for (const plugin in this.admin.status.plugins) {
      const status = this.admin.status.plugins[plugin];
      if (this.needsUpdate(status)) updates.push(this.updateMod$(modId(status)));
    }
    for (const template in this.admin.status.templates) {
      const status = this.admin.status.templates[template];
      if (this.needsUpdate(status)) updates.push(this.updateMod$(modId(status)));
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

  updatePlugin$(key: string) {
    const def = this.admin.def.plugins[key];
    const status = this.admin.status.plugins[key];
    this.installMessages.push('\u00A0'.repeat(4) + $localize`Updating ${def.name || def.tag} plugin...`);
    return this.plugins.update({
      ...def,
      defaults: {
        ...def.defaults || {},
        ...status?.defaults || {},
      },
      origin: this.store.account.origin,
      modifiedString: status?.modifiedString,
    }).pipe(
      tap(() => this.installMessages.push('\u00A0'.repeat(4) + $localize`Updated ${def.name || def.tag} plugin.`))
    );
  }

  updateTemplate$(key: string) {
    const def = this.admin.def.templates[key];
    const status = this.admin.status.templates[key];
    this.installMessages.push('\u00A0'.repeat(4) + $localize`Updating ${def.name || def.tag} template...`);
    return this.templates.update({
      ...def,
      defaults: {
        ...def.defaults || {},
        ...status?.defaults || {},
      },
      origin: this.store.account.origin,
      modifiedString: status?.modifiedString,
    }).pipe(
      tap(() => this.installMessages.push('\u00A0'.repeat(4) + $localize`Updated ${def.name || def.tag} template.`)),
    );
  }

  updateMod$(mod: string): Observable<any> {
    this.installMessages.push($localize`Updating ${mod} mod...`);
    return concat(...[
      ...Object.values(this.admin.def.plugins)
        .filter(p => modId(p) === mod)
        .map(p => this.updatePlugin$(this.admin.keyOf(this.admin.def.plugins, p.tag))),
      ...Object.values(this.admin.def.templates)
        .filter(t => modId(t) === mod)
        .map(t => this.updateTemplate$(this.admin.keyOf(this.admin.def.templates, t.tag))),
    ]).pipe(toArray());
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
