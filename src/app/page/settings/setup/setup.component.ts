import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { forOwn, mapValues } from 'lodash-es';
import { catchError, forkJoin, retry, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AdminService } from '../../../service/admin.service';
import { PluginService } from '../../../service/api/plugin.service';
import { TemplateService } from '../../../service/api/template.service';
import { ThemeService } from '../../../service/theme.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { configGroups } from '../../../util/format';
import { printError } from '../../../util/http';

@Component({
  selector: 'app-settings-setup-page',
  templateUrl: './setup.component.html',
  styleUrls: ['./setup.component.scss'],
})
export class SettingsSetupPage implements OnInit {

  experiments = !!this.admin.getPlugin('plugin/experiments');
  selectAllToggle = false;
  submitted = false;
  adminForm: UntypedFormGroup;
  serverError: string[] = [];
  installMessages: string[] = [];
  pluginGroups = configGroups(this.admin.def.plugins);
  templateGroups = configGroups(this.admin.def.templates);

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
      plugins: fb.group(mapValues(admin.status.plugins, p => fb.control(p))),
      templates: fb.group(mapValues(admin.status.templates, t => fb.control(t))),
    });
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

  updateAll() {
    const updates = [];
    for (const plugin in this.admin.status.plugins) {
      if (this.needsPluginUpdate(plugin)) updates.push(this.updatePlugin$(plugin));
    }
    for (const template in this.admin.status.templates) {
      if (this.needsTemplateUpdate(template)) updates.push(this.updateTemplate$(template));
    }
    forkJoin(updates).pipe(
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

  updatePlugin(key: string) {
    this.updatePlugin$(key).pipe(
      switchMap(() => this.admin.init$)
    ).subscribe(() => this.adminForm.reset(this.admin.status));
  }

  updateTemplate(key: string) {
    this.updateTemplate$(key).pipe(
      switchMap(() => this.admin.init$)
    ).subscribe(() => this.adminForm.reset(this.admin.status));
  }

  updatePlugin$(key: string) {
    const def = this.admin.def.plugins[key];
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

  updateTemplate$(key: string) {
    const def = this.admin.def.templates[key];
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

  needsPluginUpdate(key: string) {
    return this.admin.status.plugins[key]?.config?.needsUpdate;
  }

  needsTemplateUpdate(key: string) {
    return this.admin.status.templates[key]?.config?.needsUpdate;
  }

}
