import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, switchMap, throwError } from 'rxjs';
import { extForm, ExtFormComponent } from '../../../form/ext/ext.component';
import { linksForm } from '../../../form/links/links.component';
import { qtagsForm } from '../../../form/qtags/qtags.component';
import { queriesForm } from '../../../form/queries/queries.component';
import { themesForm } from '../../../form/themes/themes.component';
import { usersForm } from '../../../form/users/users.component';
import { Ext } from '../../../model/ext';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { ThemeService } from '../../../service/theme.service';
import { scrollToFirstInvalid } from '../../../util/form';
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
    private themeService: ThemeService,
    private router: Router,
    private route: ActivatedRoute,
    private account: AccountService,
    private exts: ExtService,
    private fb: UntypedFormBuilder,
  ) {
    themeService.setTitle('Exit Tag Extension');
    this.ext$.subscribe(ext => {
      this.ext = ext;
      this.editForm = extForm(fb, ext, admin);
      this.editForm.patchValue(ext);
    });
  }

  ngOnInit(): void {
  }

  get tag$() {
    return this.route.params.pipe(
      map(params => removeOriginWildcard(params['tag'])!),
    );
  }

  get ext$() {
    return this.tag$.pipe(
      switchMap(tag => this.exts.get(tag)),
    );
  }

  save() {
    this.serverError = [];
    this.submitted = true;
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) {
      scrollToFirstInvalid();
      return;
    }
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

  delete() {
    if (window.confirm("Are you sure you want to delete this tag extension?")) {
      this.exts.delete(this.ext.tag + this.ext.origin).pipe(
        catchError((res: HttpErrorResponse) => {
          this.serverError = printError(res);
          return throwError(() => res);
        }),
      ).subscribe(() => {
          this.router.navigate(['/tag', this.ext.tag]);
        });
    }
  }
}
