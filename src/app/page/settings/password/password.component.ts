import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, switchMap, throwError } from 'rxjs';
import { Ext } from '../../../model/ext';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { ProfileService } from '../../../service/api/profile.service';
import { QUALIFIED_TAG_REGEX, USER_REGEX } from '../../../util/format';
import { printError } from '../../../util/http';
import { localTag } from '../../../util/tag';

@Component({
  selector: 'app-settings-password-page',
  templateUrl: './password.component.html',
  styleUrls: ['./password.component.scss']
})
export class SettingsPasswordPage implements OnInit {

  submitted = false;
  passwordForm!: FormGroup;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private account: AccountService,
    private profiles: ProfileService,
    private fb: FormBuilder,
  ) {
    this.passwordForm = fb.group({
      password: [''],
    });
  }

  ngOnInit(): void {
  }

  get password() {
    return this.passwordForm.get('password') as FormControl;
  }

  save() {
    this.serverError = [];
    this.submitted = true;
    this.passwordForm.markAllAsTouched();
    if (!this.passwordForm.valid) return;
    this.profiles.changePassword({
      ...this.passwordForm.value,
      tag: this.account.tag
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.router.navigate(['/tag', this.account.tag]);
    });
  }
}
