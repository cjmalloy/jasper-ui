import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { forOwn, groupBy, isEqual, mapValues, omitBy } from 'lodash-es';
import { catchError, forkJoin, retry, switchMap, throwError } from 'rxjs';
import { Plugin, writePlugin } from '../../../model/plugin';
import { writeTemplate } from '../../../model/template';
import { AdminService } from '../../../service/admin.service';
import { PluginService } from '../../../service/api/plugin.service';
import { TemplateService } from '../../../service/api/template.service';
import { ThemeService } from '../../../service/theme.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { printError } from '../../../util/http';

@Component({
  selector: 'app-settings-setup-page',
  templateUrl: './setup.component.html',
  styleUrls: ['./setup.component.scss'],
})
export class SettingsSetupPage implements OnInit {

  selectAllToggle = false;
  submitted = false;
  adminForm: UntypedFormGroup;
  serverError: string[] = [];
  installMessages: string[] = [];
  pluginGroups = this._pluginGroups;

  constructor(
    public admin: AdminService,
    private theme: ThemeService,
    private store: Store,
    private plugins: PluginService,
    private templates: TemplateService,
    private fb: UntypedFormBuilder,
  ) {
    theme.setTitle('Settings: Setup');
    this.adminForm = fb.group({
      plugins: fb.group(mapValues(admin.status.plugins, p => fb.control(p))),
      templates: fb.group(mapValues(admin.status.templates, t => fb.control(t))),
    });
  }

  ngOnInit(): void {
  }

  get _pluginGroups() {
    const ret = Object.entries(this.admin.def.plugins).reduce((result, item) => {
      const type = result[item[1].config?.type || 'feature'] ||= {} as Record<string, Plugin>;
      type[item[0]] = item[1];
      return result;
    }, {} as Record<'feature' | 'editor' | 'viewer' | 'semantic' | 'theme', Record<string, Plugin>>);
    return ret
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
    const installs = [];
    for (const plugin in this.admin.status.plugins) {
      if (!!this.admin.status.plugins[plugin] === !!this.adminForm.value.plugins[plugin]) continue;
      const def = this.admin.def.plugins[plugin];
      if (this.adminForm.value.plugins[plugin]) {
        this.installMessages.push($localize`Installing ${def.name || def.tag} plugin...`);
        installs.push(this.plugins.create({
          ...def,
          origin: this.store.account.origin,
        }).pipe(retry(10)));
      } else {
        const status = this.admin.status.plugins[plugin]!;
        this.installMessages.push($localize`Deleting ${status.name || status.tag} plugin...`);
        installs.push(this.plugins.delete(status.tag + status.origin));
      }
    }
    for (const template in this.admin.status.templates) {
      if (!!this.admin.status.templates[template] === !!this.adminForm.value.templates[template]) continue;
      const def = this.admin.def.templates[template];
      if (this.adminForm.value.templates[template]) {
        this.installMessages.push($localize`Installing ${def.name || def.tag} template...`);
        installs.push(this.templates.create({
          ...def,
          origin: this.store.account.origin,
        }).pipe(retry(10)));
      } else {
        const status = this.admin.status.templates[template]!;
        this.installMessages.push($localize`Deleting ${status.name || status.tag} template...`);
        installs.push(this.templates.delete(status.tag + status.origin));
      }
    }
    forkJoin(installs).pipe(
      switchMap(() => this.admin.init$),
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.submitted = true;
      this.adminForm.reset(this.admin.status);
      this.installMessages.push($localize`Success.`);
    });
  }

  selectAll() {
    this.selectAllToggle = !this.selectAllToggle;
    const sa = (fg: UntypedFormGroup) => forOwn(fg.controls, c => c.setValue(this.selectAllToggle));
    sa(this.adminForm.get('plugins') as UntypedFormGroup);
    sa(this.adminForm.get('templates') as UntypedFormGroup);
  }

  needsPluginUpdate(key: string) {
    if (!this.admin.status.plugins[key]) return false;
    const def = omitBy(this.admin.def.plugins[key], i => !i);
    const status = omitBy(writePlugin(this.admin.status.plugins[key]!), i => !i);
    def.config = omitBy(def.config, i => !i);
    status.config = omitBy(status.config, i => !i);
    delete def.config!.generated;
    delete status.config!.generated;
    delete status.origin;
    delete status.modified;
    return !isEqual(def, status);
  }

  needsTemplateUpdate(key: string) {
    if (!this.admin.status.templates[key]) return false;
    const def = omitBy(this.admin.def.templates[key], i => !i);
    const status = omitBy(writeTemplate(this.admin.status.templates[key]!), i => !i);
    def.config = omitBy(def.config, i => !i);
    status.config = omitBy(status.config, i => !i);
    delete def.config!.generated;
    delete status.config!.generated;
    delete status.origin;
    delete status.modified;
    return !isEqual(def, status);
  }

  updatePlugin(key: string) {
    const def = this.admin.def.plugins[key];
    const status = this.admin.status.plugins[key]!;
    this.installMessages.push($localize`Updating ${def.name || def.tag} plugin...`);
    this.plugins.update({
      ...def,
      origin: this.store.account.origin,
      modifiedString: status.modifiedString,
    }).subscribe(() => {
      this.admin.status.plugins[key] = def;
      this.adminForm.reset(this.admin.status);
      this.installMessages.push($localize`Updated ${def.name || def.tag} plugin.`);
    });
  }

  updateTemplate(key: string) {
    const def = this.admin.def.templates[key];
    const status = this.admin.status.templates[key]!;
    this.installMessages.push($localize`Updating ${def.name || def.tag} template...`);
    this.templates.update({
      ...def,
      origin: this.store.account.origin,
      modifiedString: status.modifiedString,
    }).subscribe(() => {
      this.admin.status.templates[key] = def;
      this.adminForm.reset(this.admin.status);
      this.installMessages.push($localize`Updated ${def.name || def.tag} template.`);
    });
  }
}
