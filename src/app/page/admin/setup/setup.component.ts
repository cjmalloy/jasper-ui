import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import * as _ from 'lodash';
import { catchError, forkJoin, throwError } from 'rxjs';
import { AdminService } from '../../../service/admin.service';
import { PluginService } from '../../../service/api/plugin.service';
import { TemplateService } from '../../../service/api/template.service';
import { printError } from '../../../util/http';

@Component({
  selector: 'app-admin-setup-page',
  templateUrl: './setup.component.html',
  styleUrls: ['./setup.component.scss']
})
export class AdminSetupPage implements OnInit {

  submitted = false;
  adminForm: FormGroup;
  serverError: string[] = [];
  installMessages: string[] = [];

  constructor(
    public admin: AdminService,
    private plugins: PluginService,
    private templates: TemplateService,
    private fb: FormBuilder,
  ) {
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
    if (!this.adminForm.valid) return;
    const installs = [];
    for (const plugin in this.admin.status.plugins) {
      if (this.admin.status.plugins[plugin] === this.adminForm.value.plugins[plugin]) continue;
      if (this.adminForm.value.plugins[plugin]) {
        this.installMessages.push(`Installing ${plugin} plugin...`);
        installs.push(this.plugins.create(this.admin.def.plugins[plugin]));
      } else {
        this.installMessages.push(`Deleting ${plugin} plugin...`);
        installs.push(this.plugins.delete(`plugin/${plugin}`))
      }
    }
    for (const template in this.admin.status.templates) {
      if (this.admin.status.templates[template] === this.adminForm.value.templates[template]) continue;
      if (this.adminForm.value.templates[template]) {
        this.installMessages.push(`Installing ${template} template...`);
        installs.push(this.templates.create(this.admin.def.templates[template]));
      } else {
        this.installMessages.push(`Deleting ${template} template...`);
        installs.push(this.templates.delete(template === 'root' ? '' : template))
      }
    }
    forkJoin(installs).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(res);
      }),
    ).subscribe(() => {
      this.submitted = true;
      this.admin.status = this.adminForm.value;
      this.adminForm.reset(this.admin.status);
      this.installMessages.push('Success.')
    });
  }

}
