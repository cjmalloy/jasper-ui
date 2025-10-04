import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AdminService } from '../../../service/admin.service';
import { ProfileService } from '../../../service/api/profile.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { printError } from '../../../util/http';

@Component({
  standalone: false,
  selector: 'app-settings-password-page',
  templateUrl: './password.component.html',
  styleUrls: ['./password.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsPasswordPage {

  submitted = false;
  passwordForm!: UntypedFormGroup;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    private router: Router,
    private store: Store,
    private profiles: ProfileService,
    private fb: UntypedFormBuilder,
  ) {
    this.passwordForm = fb.group({
      password: [''],
    });
  }

  get password() {
    return this.passwordForm.get('password') as UntypedFormControl;
  }

  save() {
    this.serverError = [];
    this.submitted = true;
    this.passwordForm.markAllAsTouched();
    if (!this.passwordForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    this.profiles.changePassword({
      ...this.passwordForm.value,
      tag: this.store.account.tag
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.router.navigate(['/tag', this.store.account.tag]);
    });
  }
}
