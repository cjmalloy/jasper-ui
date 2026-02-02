import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AdminService } from '../../../service/admin.service';
import { ProfileService } from '../../../service/api/profile.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { printError } from '../../../util/http';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-settings-password-page',
  templateUrl: './password.component.html',
  styleUrls: ['./password.component.scss'],
  imports: [ReactiveFormsModule]
})
export class SettingsPasswordPage {
  admin = inject(AdminService);
  private router = inject(Router);
  private store = inject(Store);
  private profiles = inject(ProfileService);
  private fb = inject(UntypedFormBuilder);


  submitted = false;
  passwordForm!: UntypedFormGroup;
  serverError: string[] = [];

  constructor() {
    const fb = this.fb;

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
