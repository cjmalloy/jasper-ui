import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { catchError, of, switchMap, throwError } from 'rxjs';
import { extForm } from '../../form/ext/ext.component';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { ThemeService } from '../../service/theme.service';
import { Store } from '../../store/store';
import { scrollToFirstInvalid } from '../../util/form';
import { TAG_REGEX } from '../../util/format';
import { printError } from '../../util/http';
import { removeWildcard } from '../../util/tag';

@Component({
  selector: 'app-ext-page',
  templateUrl: './ext.component.html',
  styleUrls: ['./ext.component.scss'],
})
export class ExtPage implements OnInit, OnDestroy {
  private disposers: IReactionDisposer[] = [];
  @HostBinding('class') css = 'full-page-form';

  template = '';
  created = false;
  submitted = false;
  extForm: UntypedFormGroup;
  editForm!: UntypedFormGroup;
  serverError: string[] = [];

  constructor(
    private theme: ThemeService,
    private admin: AdminService,
    public router: Router,
    private route: ActivatedRoute,
    public store: Store,
    private account: AccountService,
    private exts: ExtService,
    private fb: UntypedFormBuilder,
  ) {
    theme.setTitle('Create Tag Extension');
    this.extForm = fb.group({
      tag: ['', [Validators.required, Validators.pattern(TAG_REGEX)]],
    });
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      const tag = removeWildcard(this.store.view.tag);
      if (!tag) {
        runInAction(() => this.store.view.ext = undefined);
      } else {
        this.exts.get(tag).pipe(
          catchError(() => of(undefined)),
        ).subscribe(ext => runInAction(() => {
          this.store.view.ext = ext;
          if (ext) {
            this.editForm = extForm(this.fb, ext, this.admin, true);
            this.editForm.patchValue(ext);
          }
        }));
      }
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  get tag() {
    return this.extForm.get('tag') as UntypedFormControl;
  }

  prefix(tag: string) {
    if (!this.template) return tag;
    if (tag.startsWith('+') || tag.startsWith('_')) {
      return tag.substring(0, 1) + this.template + tag.substring(1);
    }
    return this.template + tag;
  }

  create() {
    this.serverError = [];
    this.submitted = true;
    this.extForm.markAllAsTouched();
    if (!this.extForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const prefixed = this.prefix(this.tag.value);
    const tag = prefixed + this.store.account.origin;
    this.exts.create({
      tag: prefixed,
      origin: this.store.account.origin,
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        if (res.status === 409) {
          // Ignore Already exists error
          return of(null);
        }
        return throwError(() => res);
      }),
      switchMap(() => this.exts.get(tag)),
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(ext => {
      this.serverError = [];
      runInAction(() => this.store.view.ext = ext);
      this.router.navigate(['/ext', ext.tag]);
    });
  }

  save() {
    this.serverError = [];
    this.submitted = true;
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const ext = this.store.view.ext!;
    this.exts.update({
      ...ext,
      ...this.editForm.value,
      tag: ext.tag, // Need to fetch because control is disabled
      config: {
        ...ext.config,
        ...this.editForm.value.config,
      },
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.router.navigate(['/tag', ext.tag]);
    });
  }

  delete() {
    const ext = this.store.view.ext!;
    // TODO: Better dialogs
    if (window.confirm($localize`Are you sure you want to delete this tag extension?`)) {
      this.exts.delete(ext.tag + ext.origin).pipe(
        catchError((res: HttpErrorResponse) => {
          this.serverError = printError(res);
          return throwError(() => res);
        }),
      ).subscribe(() => {
        this.router.navigate(['/tag', ext.tag]);
      });
    }
  }

  clear() {
    this.router.navigateByUrl('/ext');
  }
}
