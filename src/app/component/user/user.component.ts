import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, UntypedFormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { defer, uniq } from 'lodash-es';
import { catchError, Observable, switchMap, throwError } from 'rxjs';
import { userForm, UserFormComponent } from '../../form/user/user.component';
import { Ext } from '../../model/ext';
import { getRole, Profile } from '../../model/profile';
import { User } from '../../model/user';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { ProfileService } from '../../service/api/profile.service';
import { UserService } from '../../service/api/user.service';
import { AuthzService } from '../../service/authz.service';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';
import { downloadTag } from '../../util/download';
import { scrollToFirstInvalid } from '../../util/form';
import { printError } from '../../util/http';
import { localTag, tagOrigin } from '../../util/tag';

@Component({
  selector: 'app-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss'],
})
export class UserComponent implements OnInit {
  @HostBinding('class') css = 'profile list-item';
  @HostBinding('attr.tabindex') tabIndex = 0;

  @ViewChild('inlinePassword')
  inlinePassword?: ElementRef;
  @ViewChild('inlineRole')
  inlineRole?: ElementRef;

  @Input()
  profile?: Profile;
  @Input()
  user?: User;

  editForm: UntypedFormGroup;
  ext?: Ext;
  changingPassword = false;
  changingRole = false;
  submitted = false;
  tagging = false;
  editing = false;
  viewSource = false;
  genKey = false;
  deleting = false;
  @HostBinding('class.deleted')
  deleted = false;
  writeAccess = false;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    public config: ConfigService,
    public store: Store,
    private router: Router,
    private auth: AuthzService,
    private profiles: ProfileService,
    private users: UserService,
    private exts: ExtService,
    private fb: FormBuilder,
  ) {
    this.editForm = userForm(fb, true);
  }

  @ViewChild(UserFormComponent)
  set refForm(value: UserFormComponent) {
    if (this.user) defer(() => value?.setUser(this.user!));
  }

  ngOnInit(): void {
    this.writeAccess = this.auth.tagWriteAccess(this.qualifiedTag) && this.auth.hasRole(this.role);
    if (this.user && !this.profile) {
      this.exts.getCachedExt(this.user.tag, this.user.origin)
        .subscribe(x => this.ext = x);
      this.profiles.getProfile(this.qualifiedTag)
        .subscribe(profile => this.profile = profile);
    }
  }

  get qualifiedTag() {
    return this.profile?.tag || (this.user!.tag + this.user!.origin);
  }

  get localTag() {
    return localTag(this.profile?.tag) || this.user!.tag;
  }

  get origin() {
    return tagOrigin(this.profile?.tag) || this.user?.origin || '';
  }

  get local() {
    return this.profile?.tag || (!this.user || this.user?.origin === this.store.account.origin);
  }

  download() {
    if (!this.user) {
      return downloadTag({
        tag: this.profile!.tag,
        origin: '',
      });
    }
    const user = { ...this.user };
    user.modified = user.modifiedString as any;
    delete user.type;
    delete user.modifiedString;
    downloadTag(user);
  }

  get role() {
    return getRole(this.profile?.role, this.user?.role);
  }

  setInlinePassword() {
    if (!this.inlinePassword) return;
    const password = (this.inlinePassword.nativeElement.value as string);
    this.profiles.changePassword({ tag: this.qualifiedTag, password }).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.changingPassword = false;
    });
  }

  setInlineRole() {
    if (!this.inlineRole) return;
    const role = (this.inlineRole.nativeElement.value as string).toUpperCase().trim();
    this.profiles.changeRole({ tag: this.qualifiedTag, role }).pipe(
      switchMap(() => this.profiles.getProfile(this.qualifiedTag)),
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(profile => {
      this.changingRole = false;
      this.profile = profile;
    });
  }

  activate() {
    this.profiles.activate(this.qualifiedTag).pipe(
      switchMap(() => this.profiles.getProfile(this.qualifiedTag)),
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(profile => {
      this.profile = profile;
    });
  }

  deactivate() {
    this.profiles.deactivate(this.qualifiedTag).pipe(
      switchMap(() => this.profiles.getProfile(this.qualifiedTag)),
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(profile => {
      this.profile = profile;
    });
  }

  save() {
    this.submitted = true;
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const updates = {
      ...(this.user || {}),
      ...this.editForm.value,
      tag: this.localTag,
      origin: this.origin,
      readAccess: uniq([...this.editForm.value.readAccess, ...this.editForm.value.notifications]),
    };
    (this.user ? this.users.update(updates) : this.users.create(updates))
      .pipe(
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

  copy() {
    this.catchError(this.users.create({
      ...this.user!,
      origin: this.store.account.origin,
    })).subscribe(() => {
      this.router.navigate(['/user', this.user!.tag]);
    });
  }

  catchError(o: Observable<any>) {
    return o.pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    );
  }

  delete() {
    this.serverError = [];
    if (this.user) {
      this.users.delete(this.qualifiedTag).pipe(
        catchError((err: HttpErrorResponse) => {
          this.serverError.push(...printError(err));
          return throwError(() => err);
        }),
      ).subscribe(() => {
        this.deleting = false;
        this.deleted = true;
      });
    }
    if (this.profile) {
      this.profiles.delete(this.qualifiedTag).pipe(
        catchError((err: HttpErrorResponse) => {
          this.serverError.push(...printError(err));
          return throwError(() => err);
        }),
      ).subscribe(() => {
        this.serverError = [];
        this.deleting = false;
        this.deleted = true;
      });
    }
  }

  keygen() {
    this.serverError = [];
    if (this.user) {
      this.users.keygen(this.qualifiedTag).pipe(
        catchError((err: HttpErrorResponse) => {
          this.serverError.push(...printError(err));
          return throwError(() => err);
        }),
      ).pipe(
        switchMap(() => this.users.get(this.qualifiedTag))
      ).subscribe(user => {
        this.user = user;
        this.serverError = [];
        this.genKey = false;
      });
    }
  }
}
