import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { ProfileService } from '../../../service/api/profile.service';
import { ThemeService } from '../../../service/theme.service';
import { scrollToFirstInvalid } from '../../../util/form';
import { USER_REGEX } from '../../../util/format';
import { printError } from '../../../util/http';

@Component({
  selector: 'app-create-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class CreateProfilePage implements OnInit {

  submitted = false;
  profileForm: UntypedFormGroup;
  serverError: string[] = [];

  constructor(
    private theme: ThemeService,
    private admin: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private account: AccountService,
    private profiles: ProfileService,
    private fb: UntypedFormBuilder,
  ) {
    theme.setTitle('Create Profile');
    this.profileForm = fb.group({
      tag: ['', [Validators.required, Validators.pattern(USER_REGEX)]],
      password: [''],
      role: [''],
    });
    route.queryParams.subscribe(params => {
      if (params['tag']) {
        this.tag.setValue(params['tag']);
      }
    });
  }

  ngOnInit(): void {
  }

  get tag() {
    return this.profileForm.get('tag') as UntypedFormControl;
  }

  get password() {
    return this.profileForm.get('password') as UntypedFormControl;
  }

  get role() {
    return this.profileForm.get('role') as UntypedFormControl;
  }

  create() {
    this.serverError = [];
    this.submitted = true;
    this.profileForm.markAllAsTouched();
    if (!this.profileForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    this.profiles.create(this.profileForm.value).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.router.navigate(['/settings/profile']);
    });
  }
}
