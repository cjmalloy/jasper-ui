import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  HostBinding,
  inject,
  Injector,
  OnInit,
  viewChild
} from '@angular/core';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { defer, uniq } from 'lodash-es';

import { catchError, forkJoin, Observable, of, switchMap, throwError } from 'rxjs';
import { SettingsComponent } from '../../component/settings/settings.component';
import { LimitWidthDirective } from '../../directive/limit-width.directive';
import { userForm, UserFormComponent } from '../../form/user/user.component';
import { HasChanges } from '../../guard/pending-changes.guard';
import { isDeletorTag, tagDeleteNotice } from '../../mods/delete';
import { AdminService } from '../../service/admin.service';
import { ProfileService } from '../../service/api/profile.service';
import { UserService } from '../../service/api/user.service';
import { ConfigService } from '../../service/config.service';
import { ModService } from '../../service/mod.service';
import { Store } from '../../store/store';
import { scrollToFirstInvalid } from '../../util/form';
import { printError } from '../../util/http';
import { prefix, setPublic } from '../../util/tag';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-user-page',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss'],
  imports: [ RouterLink, SettingsComponent, ReactiveFormsModule, LimitWidthDirective, UserFormComponent]
})
export class UserPage implements OnInit, HasChanges {
  private injector = inject(Injector);
  private mod = inject(ModService);
  private admin = inject(AdminService);
  config = inject(ConfigService);
  router = inject(Router);
  store = inject(Store);
  private profiles = inject(ProfileService);
  private users = inject(UserService);
  private fb = inject(UntypedFormBuilder);


  @HostBinding('class') css = 'full-page-form';

  readonly userForm = viewChild.required<UserFormComponent>('form');

  submitted = false;
  profileForm: UntypedFormGroup;
  serverError: string[] = [];
  externalErrors: string[] = [];

  constructor() {
    const mod = this.mod;
    const fb = this.fb;

    mod.setTitle($localize`Create Profile`);
    this.profileForm = fb.group({
      active: [true],
      password: [''],
      role: [''],
      user: userForm(fb),
    });
  }

  ngOnInit(): void {
    effect(() => {
      if (!this.store.view.tag) {
        this.store.view.selectedUser = undefined;
      } else {
        const tag = this.store.view.localTag + this.store.account.origin;
        this.users.get(tag).pipe(
          catchError(() => of(undefined)),
        ).subscribe(user => {
          this.store.view.selectedUser = user;
          if (user) {
            this.profileForm.setControl('user', userForm(this.fb, true));
            defer(() => this.userForm().setUser(user));
          } else {
            this.profileForm.setControl('user', userForm(this.fb, false));
            defer(() => this.userForm().setUser({
              tag: this.store.view.localTag,
              origin: this.store.view.origin,
              readAccess: this.admin.readAccess.map(t => setPublic(prefix(t, this.store.view.localTag))),
              writeAccess: this.admin.writeAccess.map(t => setPublic(prefix(t, this.store.view.localTag))),
            }));
          }
        });
      }
    }, { injector: this.injector });
  }

  saveChanges() {
    return !this.profileForm?.dirty;
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
    this.externalErrors = [];
    try {
      if (!updates.external) delete updates.external;
      if (updates.external) updates.external = JSON.parse(updates.external);
    } catch (e: any) {
      this.externalErrors.push(e.message);
    }
    const entities: Observable<any>[] = [
      (this.store.view.selectedUser
        ? this.users.update(updates)
        : this.users.create(updates)).pipe(
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
    if (confirm($localize`Are you sure you want to delete this user?`)) {
      const deleteNotice = !isDeletorTag(this.store.view.selectedUser!.tag) && this.admin.getPlugin('plugin/delete')
        ? this.users.create(tagDeleteNotice(this.store.view.selectedUser!))
        : of(null);
      this.users.delete(this.store.view.localTag + this.store.account.origin).pipe(
        switchMap(() => deleteNotice),
        catchError((err: HttpErrorResponse) => {
          this.serverError = printError(err);
          return throwError(() => err);
        }),
      ).subscribe(() => {
        this.router.navigate(['/tag', this.store.view.localTag + this.store.account.origin]);
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
