import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import * as _ from 'lodash-es';
import { catchError, switchMap, throwError } from 'rxjs';
import { userForm, UserFormComponent } from '../../form/user/user.component';
import { User } from '../../model/user';
import { AdminService } from '../../service/admin.service';
import { UserService } from '../../service/api/user.service';
import { AuthService } from '../../service/auth.service';
import { printError } from '../../util/http';

@Component({
  selector: 'app-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss'],
})
export class UserComponent implements OnInit {
  @HostBinding('class') css = 'user list-item';
  @HostBinding('attr.tabindex') tabIndex = 0;

  @Input()
  user!: User;

  editForm: UntypedFormGroup;
  submitted = false;
  tagging = false;
  editing = false;
  deleting = false;
  @HostBinding('class.deleted')
  deleted = false;
  writeAccess = false;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    private router: Router,
    private auth: AuthService,
    private users: UserService,
    private fb: UntypedFormBuilder,
  ) {
    this.editForm = userForm(fb);
  }

  @ViewChild(UserFormComponent)
  set refForm(value: UserFormComponent) {
    _.defer(() => value?.setUser(this.user));
  }

  ngOnInit(): void {
    this.writeAccess = this.auth.tagWriteAccess(this.user.tag, 'user');
  }

  get qualifiedTag() {
    return this.user.tag + this.user.origin;
  }

  save() {
    this.submitted = true;
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) return;
    this.users.update({
      ...this.user,
      ...this.editForm.value,
    }).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
      switchMap(() => this.users.get(this.qualifiedTag)),
    ).subscribe(user => {
      this.serverError = [];
      this.editing = false;
      this.user = user;
    });
  }

  delete() {
    this.users.delete(this.user.tag).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(() => {
      this.serverError = [];
      this.deleted = true;
    });
  }
}
