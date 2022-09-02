import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import * as _ from 'lodash-es';
import { catchError, forkJoin, retry, switchMap, throwError } from 'rxjs';
import { AdminService } from '../../../service/admin.service';
import { PluginService } from '../../../service/api/plugin.service';
import { TemplateService } from '../../../service/api/template.service';
import { ThemeService } from '../../../service/theme.service';
import { scrollToFirstInvalid } from '../../../util/form';
import { printError } from '../../../util/http';

@Component({
  selector: 'app-settings-setup-page',
  templateUrl: './setup.component.html',
  styleUrls: ['./setup.component.scss'],
})
export class SettingsSetupPage implements OnInit {

  submitted = false;
  adminForm: UntypedFormGroup;
  serverError: string[] = [];
  installMessages: string[] = [];

  constructor(
    public admin: AdminService,
    private theme: ThemeService,
    private plugins: PluginService,
    private templates: TemplateService,
    private fb: UntypedFormBuilder,
  ) {
    theme.setTitle('Settings: Setup');
    this.adminForm = fb.group({
      plugins: fb.group(_.mapValues(admin.status.plugins, p => fb.control(p))),
      templates: fb.group(_.mapValues(admin.status.templates, t => fb.control(t))),
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
        this.installMessages.push(`Installing ${def.name || def.tag} plugin...`);
        installs.push(this.plugins.create(def).pipe(retry(10)));
      } else {
        this.installMessages.push(`Deleting ${def.name || def.tag} plugin...`);
        installs.push(this.plugins.delete(def.tag));
      }
    }
    for (const template in this.admin.status.templates) {
      if (!!this.admin.status.templates[template] === !!this.adminForm.value.templates[template]) continue;
      const def = this.admin.def.templates[template];
      if (this.adminForm.value.templates[template]) {
        this.installMessages.push(`Installing ${def.name || def.tag} template...`);
        installs.push(this.templates.create(def).pipe(retry(10)));
      } else {
        this.installMessages.push(`Deleting ${def.name || def.tag} template...`);
        installs.push(this.templates.delete(def.tag));
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
      this.installMessages.push('Success.');
    });
  }

}
