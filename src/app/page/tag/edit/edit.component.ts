import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, switchMap, throwError } from 'rxjs';
import { linksForm } from '../../../form/links/links.component';
import { queriesForm } from '../../../form/queries/queries.component';
import { themesForm } from '../../../form/themes/themes.component';
import { usersForm } from '../../../form/users/users.component';
import { Ext } from '../../../model/ext';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { printError } from '../../../util/http';
import { removeOriginWildcard } from '../../../util/tag';

@Component({
  selector: 'app-edit-tag-page',
  templateUrl: './edit.component.html',
  styleUrls: ['./edit.component.scss'],
})
export class EditTagPage implements OnInit {

  ext!: Ext;
  submitted = false;
  editForm!: FormGroup;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private account: AccountService,
    private exts: ExtService,
    private fb: FormBuilder,
  ) {
    this.ext$.subscribe(ext => {
      this.ext = ext;
      let configControls = {};
      if (this.root) {
        configControls = {
          ...configControls,
          sidebar: [''],
          pinned: linksForm(fb, ext.config?.pinned),
          themes: themesForm(fb, ext.config?.themes),
          theme: [''],
        };
      }
      if (this.user) {
        configControls = {
          ...configControls,
          subscriptions: queriesForm(fb, ext.config?.subscriptions),
          bookmarks: queriesForm(fb, ext.config?.bookmarks),
          userThemes: themesForm(fb, ext.config?.userThemes),
          userTheme: [''],
        };
      }
      if (this.queue) {
        configControls = {
          ...configControls,
          bounty: [''],
          maxAge: [''],
          approvers: usersForm(fb, ext.config?.approvers),
        };
      }
      this.editForm = fb.group({
        tag: [''],
        name: [''],
        config: fb.group(configControls),
      });
      this.editForm.patchValue(ext);
    });
  }

  ngOnInit(): void {
  }

  get root() {
    return !!this.admin.status.templates.root;
  }

  get user() {
    return !!this.admin.status.templates.user && (
      this.ext.tag.startsWith('_user/') ||
      this.ext.tag.startsWith('+user/'));
  }

  get queue() {
    return !!this.admin.status.templates.queue && (
      this.ext.tag.startsWith('queue/') ||
      this.ext.tag.startsWith('_queue/') ||
      this.ext.tag.startsWith('+queue/'));
  }

  get tag$() {
    return this.route.params.pipe(
      map(params => removeOriginWildcard(params['tag'])),
    );
  }

  get ext$() {
    return this.tag$.pipe(
      switchMap(tag => this.exts.get(tag)),
    );
  }

  get tag() {
    return this.editForm.get('tag') as FormControl;
  }

  get name() {
    return this.editForm.get('name') as FormControl;
  }

  get config() {
    return this.editForm.get('config') as FormGroup;
  }

  get sidebar() {
    return this.config.get('sidebar') as FormControl;
  }

  get themes() {
    return this.config.get('themes') as FormGroup;
  }

  get userThemes() {
    return this.config.get('userThemes') as FormGroup;
  }

  get themeValues() {
    return Object.keys(this.themes?.value);
  }

  get userThemeValues() {
    return Object.keys(this.userThemes?.value);
  }

  get theme() {
    return this.config.get('theme') as FormControl;
  }

  get userTheme() {
    return this.config.get('userTheme') as FormControl;
  }

  get bounty() {
    return this.config.get('bounty') as FormControl;
  }

  get maxAge() {
    return this.config.get('maxAge') as FormControl;
  }

  save() {
    this.serverError = [];
    this.submitted = true;
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) return;
    this.exts.update({
      ...this.ext,
      ...this.editForm.value,
      config: {
        ...this.ext.config,
        ...this.editForm.value.config,
      },
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.router.navigate(['/tag', this.ext.tag]);
    });
  }
}
