import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, switchMap, throwError } from 'rxjs';
import { linksForm } from '../../../form/links/links.component';
import { qtagsForm } from '../../../form/qtags/qtags.component';
import { queriesForm } from '../../../form/queries/queries.component';
import { themesForm } from '../../../form/themes/themes.component';
import { usersForm } from '../../../form/users/users.component';
import { Ext } from '../../../model/ext';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { printError } from '../../../util/http';
import { hasPrefix, removeOriginWildcard } from '../../../util/tag';

@Component({
  selector: 'app-edit-tag-page',
  templateUrl: './edit.component.html',
  styleUrls: ['./edit.component.scss'],
})
export class EditTagPage implements OnInit {

  ext!: Ext;
  submitted = false;
  editForm!: UntypedFormGroup;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private account: AccountService,
    private exts: ExtService,
    private fb: UntypedFormBuilder,
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
      if (this.kanban) {
        configControls = {
          ...configControls,
          columns: qtagsForm(fb, ext.config?.columns),
          showNoColumn: [false],
          noColumnTitle: [''],
          swimLanes: qtagsForm(fb, ext.config?.swimLanes || []),
          showNoSwimLane: [false],
          noSwimLaneTitle: [''],
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
    return !!this.admin.status.templates.queue && hasPrefix(this.ext.tag, 'queue');
  }

  get kanban() {
    return !!this.admin.status.templates.kanban && hasPrefix(this.ext.tag, 'kanban');
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

  get config() {
    return this.editForm.get('config') as UntypedFormGroup;
  }

  get sidebar() {
    return this.config.get('sidebar') as UntypedFormControl;
  }

  get themes() {
    return this.config.get('themes') as UntypedFormGroup;
  }

  get userThemes() {
    return this.config.get('userThemes') as UntypedFormGroup;
  }

  get themeValues() {
    return Object.keys(this.themes?.value);
  }

  get userThemeValues() {
    return Object.keys(this.userThemes?.value);
  }

  get theme() {
    return this.config.get('theme') as UntypedFormControl;
  }

  get userTheme() {
    return this.config.get('userTheme') as UntypedFormControl;
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
