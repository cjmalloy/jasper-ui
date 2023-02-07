import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { uniq } from 'lodash-es';
import { catchError, forkJoin, throwError } from 'rxjs';
import { userForm } from '../../../form/user/user.component';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { ProfileService } from '../../../service/api/profile.service';
import { UserService } from '../../../service/api/user.service';
import { ConfigService } from '../../../service/config.service';
import { ThemeService } from '../../../service/theme.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { printError } from '../../../util/http';
import { prefix } from '../../../util/tag';

@Component({
  selector: 'app-create-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss']
})
export class CreateUserPage implements OnInit {
  @HostBinding('class') css = 'full-page-form';

  submitted = false;
  profileForm: UntypedFormGroup;
  serverError: string[] = [];

  constructor(
    private theme: ThemeService,
    private admin: AdminService,
    public config: ConfigService,
    private router: Router,
    private route: ActivatedRoute,
    private store: Store,
    private account: AccountService,
    private profiles: ProfileService,
    private users: UserService,
    private fb: UntypedFormBuilder,
  ) {
    theme.setTitle('Create Profile');
    this.profileForm = fb.group({
      active: [true],
      password: [''],
      role: [''],
      user: userForm(fb),
    });
    route.queryParams.subscribe(params => {
      if (params['tag']) {
        this.tag.setValue(params['tag']);
      }
    });
  }

  ngOnInit(): void {
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

  create() {
    this.serverError = [];
    this.submitted = true;
    this.profileForm.markAllAsTouched();
    if (!this.profileForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const user = this.profileForm.value.user.tag;
    const readAccess = uniq([...this.profileForm.value.user.readAccess, ...this.admin.readAccess.map(t => prefix(t, user))])
    const writeAccess = uniq([...this.profileForm.value.user.readAccess, ...this.admin.writeAccess.map(t => prefix(t, user))])
    const entities = [
      this.users.create({
        ...this.profileForm.value.user,
        tag: user,
        readAccess,
        writeAccess,
        origin: this.store.account.origin,
      }).pipe(
        catchError((res: HttpErrorResponse) => {
          this.serverError.push(...printError(res));
          return throwError(() => res);
        }),
      )
    ];
    if (this.config.scim) {
      entities.push(this.profiles.create({
        tag: user + this.store.account.origin,
        password: this.profileForm.value.password,
        role: this.profileForm.value.role,
      }).pipe(
        catchError((res: HttpErrorResponse) => {
          this.serverError.push(...printError(res));
          return throwError(() => res);
        }),
      ));
    }
    forkJoin(entities).subscribe(() => this.router.navigate(['/settings/user']));
  }
}
