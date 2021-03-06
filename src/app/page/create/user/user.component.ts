import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { UserService } from '../../../service/api/user.service';
import { ThemeService } from '../../../service/theme.service';
import { QUALIFIED_TAG_REGEX, USER_REGEX } from '../../../util/format';
import { printError } from '../../../util/http';
import { prefix } from '../../../util/tag';

@Component({
  selector: 'app-create-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss'],
})
export class CreateUserPage implements OnInit {

  submitted = false;
  userForm: FormGroup;
  serverError: string[] = [];

  constructor(
    private theme: ThemeService,
    private admin: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private account: AccountService,
    private users: UserService,
    private fb: FormBuilder,
  ) {
    theme.setTitle('Create User Permissions');
    this.userForm = fb.group({
      tag: ['', [Validators.required, Validators.pattern(USER_REGEX)]],
      name: [''],
      readAccess: fb.array([]),
      writeAccess: fb.array([]),
      tagReadAccess: fb.array([]),
      tagWriteAccess: fb.array([]),
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
    return this.userForm.get('tag') as FormControl;
  }

  get name() {
    return this.userForm.get('name') as FormControl;
  }

  get readAccess() {
    return this.userForm.get('readAccess') as FormArray;
  }

  get writeAccess() {
    return this.userForm.get('writeAccess') as FormArray;
  }

  get tagReadAccess() {
    return this.userForm.get('tagReadAccess') as FormArray;
  }

  get tagWriteAccess() {
    return this.userForm.get('tagWriteAccess') as FormArray;
  }

  addReadAccess(value = '') {
    this.readAccess.push(this.fb.control(value, [Validators.required, Validators.pattern(QUALIFIED_TAG_REGEX)]));
    this.submitted = false;
  }

  removeReadAccess(index: number) {
    this.readAccess.removeAt(index);
  }

  addWriteAccess() {
    this.writeAccess.push(this.fb.control('', [Validators.required, Validators.pattern(QUALIFIED_TAG_REGEX)]));
    this.submitted = false;
  }

  removeWriteAccess(index: number) {
    this.writeAccess.removeAt(index);
  }

  addTagReadAccess(value = '') {
    this.tagReadAccess.push(this.fb.control(value, [Validators.required, Validators.pattern(QUALIFIED_TAG_REGEX)]));
    this.submitted = false;
  }

  removeTagReadAccess(index: number) {
    this.tagReadAccess.removeAt(index);
  }

  addTagWriteAccess() {
    this.tagWriteAccess.push(this.fb.control('', [Validators.required, Validators.pattern(QUALIFIED_TAG_REGEX)]));
    this.submitted = false;
  }

  removeTagWriteAccess(index: number) {
    this.tagWriteAccess.removeAt(index);
  }

  create() {
    this.serverError = [];
    this.submitted = true;
    this.userForm.markAllAsTouched();
    const inbox = prefix('plugin/inbox/', this.userForm.value.tag);
    if (this.admin.status.plugins.inbox && !this.userForm.value.readAccess.includes) {
      this.addReadAccess(inbox);
    }
    if (!this.userForm.valid) return;
    this.users.create(this.userForm.value).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.router.navigate(['/settings/user']);
    });
  }
}
