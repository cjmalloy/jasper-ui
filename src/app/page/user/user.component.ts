import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { defer, uniq } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { catchError, forkJoin, ignoreElements, of, throwError } from 'rxjs';
import { userForm, UserFormComponent } from '../../form/user/user.component';
import { HasChanges } from '../../guard/pending-changes.guard';
import { tagDeleteNotice } from "../../mods/delete";
import { AdminService } from '../../service/admin.service';
import { ProfileService } from '../../service/api/profile.service';
import { UserService } from '../../service/api/user.service';
import { ConfigService } from '../../service/config.service';
import { ThemeService } from '../../service/theme.service';
import { Store } from '../../store/store';
import { scrollToFirstInvalid } from '../../util/form';
import { printError } from '../../util/http';
import { prefix, setPublic } from '../../util/tag';

@Component({
  selector: 'app-user-page',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss']
})
export class UserPage implements OnInit, OnDestroy, HasChanges {
  private disposers: IReactionDisposer[] = [];
  @HostBinding('class') css = 'full-page-form';

  @ViewChild(UserFormComponent)
  userForm!: UserFormComponent;

  submitted = false;
  profileForm: UntypedFormGroup;
  serverError: string[] = [];

  constructor(
    private theme: ThemeService,
    private admin: AdminService,
    public config: ConfigService,
    public router: Router,
    public store: Store,
    private profiles: ProfileService,
    private users: UserService,
    private fb: UntypedFormBuilder,
  ) {
    theme.setTitle($localize`Create Profile`);
    this.profileForm = fb.group({
      active: [true],
      password: [''],
      role: [''],
      user: userForm(fb),
    });
  }

  saveChanges() {
    return !this.profileForm?.dirty;
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      if (!this.store.view.tag) {
        runInAction(() => this.store.view.selectedUser = undefined);
      } else {
        const tag = this.store.view.localTag + this.store.account.origin;
        this.users.get(tag).pipe(
          catchError(() => of(undefined)),
        ).subscribe(user => runInAction(() => {
          this.store.view.selectedUser = user;
          if (user) {
            this.profileForm.setControl('user', userForm(this.fb, true));
            defer(() => this.userForm.setUser(user));
          } else {
            this.profileForm.setControl('user', userForm(this.fb, false));
            defer(() => this.userForm.setUser({
              tag: this.store.view.localTag,
              origin: this.store.view.origin,
              readAccess: this.admin.readAccess.map(t => prefix(t, setPublic(this.store.view.localTag))),
              writeAccess: this.admin.writeAccess.map(t => prefix(t, setPublic(this.store.view.localTag))),
            }));
          }
        }));
      }
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  get active() {
    return this.profileForm.get('active') as UntypedFormControl;
  }

  get password() {
    return this.profileForm.get('password') as UntypedFormControl;
  }

  get role() {
    return this.profileForm.get('role') as UntypedFormControl;
  }

  get user() {
    return this.profileForm.get('user') as UntypedFormGroup;
  }

  get tag() {
    return this.user.get('tag') as UntypedFormGroup;
  }

  save() {
    this.serverError = [];
    this.submitted = true;
    this.profileForm.markAllAsTouched();
    if (!this.profileForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const updates = {
      ...(this.store.view.selectedUser || {}),
      ...this.user.value,
      tag: this.store.view.localTag,
      origin: this.store.account.origin,
      readAccess: uniq([...this.user.value.readAccess, ...this.user.value.notifications]),
    };
    delete updates.notifications;
    const entities = [
      (this.store.view.selectedUser ? this.users.update(updates).pipe(ignoreElements()) : this.users.create(updates)).pipe(
        catchError((res: HttpErrorResponse) => {
          this.serverError.push(...printError(res));
          return throwError(() => res);
        }),
      )
    ];
    if (this.config.scim) {
      const profile = {
        tag: this.store.view.localTag + this.store.account.origin,
        password: this.profileForm.value.password,
        role: this.profileForm.value.role,
      };
      if (this.store.view.selectedUser) {
        if (this.password.touched) {
          entities.push(this.profiles.changePassword(profile));
        }
        if (this.active.touched) {
          entities.push(this.active.value ?
            this.profiles.activate(profile.tag) :
            this.profiles.deactivate(profile.tag));
        }
        if (this.role.touched) {
          entities.push(this.profiles.changeRole(profile));
        }
      } else {
        entities.push(this.profiles.create(profile).pipe(
          catchError((res: HttpErrorResponse) => {
            this.serverError.push(...printError(res));
            return throwError(() => res);
          }),
        ));
      }
    }
    forkJoin(entities).subscribe(() => {
      this.profileForm.markAsPristine();
      this.router.navigate(['/tag', this.tag.value + this.store.account.origin])
    });
  }

  delete() {
    // TODO: Better dialogs
    if (window.confirm($localize`Are you sure you want to delete this user?`)) {
      (this.admin.getPlugin('plugin/delete')
        ? this.users.update(tagDeleteNotice(this.store.view.selectedUser!)).pipe(ignoreElements())
        : this.users.delete(this.store.view.localTag + this.store.account.origin)).pipe(
        catchError((res: HttpErrorResponse) => {
          this.serverError = printError(res);
          return throwError(() => res);
        }),
      ).subscribe(() => {
        this.router.navigate(['/tag', this.tag.value + this.store.account.origin]);
      });
    }
  }

  setTag(tag: string) {
    this.router.navigate(['/user', tag]);
  }

  clear() {
    this.router.navigateByUrl('/user');
  }
}
