import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { userForm, UserFormComponent } from '../../../form/user/user.component';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { UserService } from '../../../service/api/user.service';
import { ThemeService } from '../../../service/theme.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { printError } from '../../../util/http';
import { prefix } from '../../../util/tag';

@Component({
  selector: 'app-create-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss'],
})
export class CreateUserPage implements OnInit {
  @HostBinding('class') css = 'full-page-form';

  submitted = false;
  userForm: UntypedFormGroup;
  serverError: string[] = [];

  @ViewChild(UserFormComponent)
  user!: UserFormComponent;

  constructor(
    private theme: ThemeService,
    private admin: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private store: Store,
    private account: AccountService,
    private users: UserService,
    private fb: UntypedFormBuilder,
  ) {
    theme.setTitle('Create User Permissions');
    this.userForm = userForm(fb);
    route.queryParams.subscribe(params => {
      if (params['tag']) {
        this.tag.setValue(params['tag']);
      }
    });
  }

  ngOnInit(): void {
  }

  get tag() {
    return this.userForm.get('tag') as UntypedFormControl;
  }

  get name() {
    return this.userForm.get('name') as UntypedFormControl;
  }

  create() {
    this.serverError = [];
    this.submitted = true;
    this.userForm.markAllAsTouched();
    const inbox = prefix('plugin/inbox', this.userForm.value.tag);
    if (this.admin.status.plugins.inbox && !this.userForm.value.readAccess.includes) {
      this.user.readAccess.addTag(inbox);
    }
    if (!this.userForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    this.users.create({
      ...this.userForm.value,
      origin: this.store.account.origin,
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.router.navigate(['/settings/user']);
    });
  }
}
