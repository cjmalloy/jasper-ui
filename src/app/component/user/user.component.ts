import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, Observable, switchMap, throwError } from 'rxjs';
import { User } from '../../model/user';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { UserService } from '../../service/api/user.service';
import { QUALIFIED_TAG_REGEX } from '../../util/format';
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

  editForm: FormGroup;
  submitted = false;
  tagging = false;
  editing = false;
  deleting = false;
  @HostBinding('class.deleted')
  deleted = false;
  writeAccess$?: Observable<boolean>;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    private router: Router,
    private account: AccountService,
    private users: UserService,
    private fb: FormBuilder,
  ) {
    this.editForm = fb.group({
      name: [''],
      readAccess: fb.array([]),
      writeAccess: fb.array([]),
      tagReadAccess: fb.array([]),
      tagWriteAccess: fb.array([]),
    });
  }

  ngOnInit(): void {
    this.writeAccess$ = this.account.tagWriteAccess(this.user.tag, 'user');
    while (this.readAccess.length < (this.user?.readAccess?.length || 0)) this.addReadAccess();
    while (this.writeAccess.length < (this.user?.writeAccess?.length || 0)) this.addWriteAccess();
    while (this.tagReadAccess.length < (this.user?.tagReadAccess?.length || 0)) this.addTagReadAccess();
    while (this.tagWriteAccess.length < (this.user?.tagWriteAccess?.length || 0)) this.addTagWriteAccess();
    this.editForm.patchValue(this.user);
  }

  get qualifiedTag() {
    return this.user.tag + this.user.origin;
  }

  get name() {
    return this.editForm.get('name') as FormControl;
  }

  get readAccess() {
    return this.editForm.get('readAccess') as FormArray;
  }

  get writeAccess() {
    return this.editForm.get('writeAccess') as FormArray;
  }

  get tagReadAccess() {
    return this.editForm.get('tagReadAccess') as FormArray;
  }

  get tagWriteAccess() {
    return this.editForm.get('tagWriteAccess') as FormArray;
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

  save() {
    this.submitted = true;
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) return;
    this.users.update({
      ...this.user,
      ...this.editForm.value,
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
      switchMap(() => this.users.get(this.qualifiedTag)),
    ).subscribe(user => {
      this.editing = false;
      this.user = user;
    });
  }

  delete() {
    this.users.delete(this.user.tag).subscribe(() => {
      this.deleted = true;
    });
  }
}
