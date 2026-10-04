import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal, inject } from '@angular/core';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AdminService } from '../../../service/admin.service';
import { ProfileService } from '../../../service/api/profile.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid, controlState } from '../../../util/form';
import { printError } from '../../../util/http';

@Component({
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


  readonly submitted = signal<boolean>(false);
  readonly serverError = signal<string[]>([]);
  passwordForm!: UntypedFormGroup;
  protected readonly passwordFormValid = controlState(() => this.passwordForm, c => c.valid);

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
    this.serverError.set([]);
    this.submitted.set(true);
    this.passwordForm.markAllAsTouched();
    if (!this.passwordForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    this.profiles.changePassword({
      ...this.passwordForm.value,
      tag: this.store.account.tag()
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError.set(printError(res));
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.router.navigate(['/tag', this.store.account.tag()]);
    });
  }
}
