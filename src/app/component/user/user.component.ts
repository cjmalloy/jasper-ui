import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  HostBinding,
  Input,
  OnChanges,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren
} from '@angular/core';
import { FormBuilder, UntypedFormGroup } from '@angular/forms';
import { defer, uniq } from 'lodash-es';
import { DateTime } from 'luxon';
import { catchError, forkJoin, of, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { userForm, UserFormComponent } from '../../form/user/user.component';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Ext } from '../../model/ext';
import { getRole, Profile } from '../../model/profile';
import { Role, User } from '../../model/user';
import { isDeletorTag, tagDeleteNotice } from '../../mods/delete';
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
import { memo, MemoCache } from '../../util/memo';
import { localTag, tagOrigin } from '../../util/tag';
import { ActionComponent } from '../action/action.component';

@Component({
  standalone: false,
  selector: 'app-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss'],
  host: {'class': 'profile list-item'}
})
export class UserComponent implements OnChanges, HasChanges {
  @HostBinding('attr.tabindex') tabIndex = 0;

  @ViewChildren('action')
  actionComponents?: QueryList<ActionComponent>;

  @Input()
  profile?: Profile;
  @Input()
  user?: User;

  editForm: UntypedFormGroup;
  ext?: Ext;
  submitted = false;
  editing = false;
  viewSource = false;
  genKey = false;
  @HostBinding('class.deleted')
  deleted = false;
  writeAccess = false;
  serverError: string[] = [];
  externalErrors: string[] = [];

  constructor(
    public admin: AdminService,
    public config: ConfigService,
    public store: Store,
    private auth: AuthzService,
    private profiles: ProfileService,
    private users: UserService,
    private exts: ExtService,
    private fb: FormBuilder,
  ) {
    this.editForm = userForm(fb, true);
  }

  saveChanges() {
    return !this.editing || !this.editForm.dirty;
  }

  init() {
    MemoCache.clear(this);
    this.actionComponents?.forEach(c => c.reset());
    this.writeAccess = this.auth.tagWriteAccess(this.qualifiedTag) && this.auth.hasRole(this.role);
    if (this.created && !this.profile) {
      this.exts.get(this.user!.tag, this.user!.origin)
      .subscribe(x => this.ext = x);
      this.profiles.getProfile(this.qualifiedTag)
      .subscribe(profile => this.profile = profile);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.user || changes.profile) {
      this.init();
    }
  }

  @ViewChild(UserFormComponent)
  set refForm(value: UserFormComponent) {
    if (this.user) defer(() => value?.setUser(this.user!));
  }

  @memo
  get created() {
    return this.user?.modified;
  }

  @memo
  get qualifiedTag() {
    return this.profile?.tag || (this.user!.tag + this.user!.origin);
  }

  @memo
  get localTag() {
    return localTag(this.profile?.tag) || this.user!.tag;
  }

  @memo
  get origin() {
    return tagOrigin(this.profile?.tag) || this.user?.origin || '';
  }

  @memo
  get local() {
    return this.profile?.tag || (!this.user || this.user?.origin === this.store.account.origin);
  }

  @memo
  get role() {
    return getRole(this.profile?.role, this.user?.role);
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

  setPassword$ = (password: string) => {
    return this.profiles.changePassword({ tag: this.qualifiedTag, password }).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    );
  }

  ban$ = () => {
    return this.setRole$('ROLE_BANNED');
  }

  setRole$ = (role?: Role) => {
    if (!role) return of(null);
    this.serverError = [];
    role = role.toUpperCase().trim() as Role;
    if (this.config.scim) {
      return this.profiles.changeRole({ tag: this.qualifiedTag, role }).pipe(
        switchMap(() => this.profiles.getProfile(this.qualifiedTag)),
        tap(profile => {
          this.profile = profile;
          this.init();
        }),
        catchError((res: HttpErrorResponse) => {
          this.serverError = printError(res);
          return throwError(() => res);
        }),
      );
    } else {
      this.user ||= { tag: this.qualifiedTag };
      this.user.role = role;
      return this.users.update(this.user).pipe(
        tap(cursor => {
          this.user!.modifiedString = cursor;
          this.user!.modified = DateTime.fromISO(cursor);
          this.init();
        }),
        catchError((res: HttpErrorResponse) => {
          this.serverError = printError(res);
          return throwError(() => res);
        }),
      );
    }
  }

  activate$ = () => {
    return this.profiles.activate(this.qualifiedTag).pipe(
      switchMap(() => this.profiles.getProfile(this.qualifiedTag)),
      tap(profile => {
        this.profile = profile;
        this.init();
      }),
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    );
  }

  deactivate$ = () => {
    return this.profiles.deactivate(this.qualifiedTag).pipe(
      switchMap(() => this.profiles.getProfile(this.qualifiedTag)),
      tap(profile => {
        this.profile = profile;
        this.init();
      }),
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    );
  }

  save() {
    this.submitted = true;
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const updates: User = {
      ...(this.user || {}),
      ...this.editForm.value,
      tag: this.localTag,
      origin: this.origin,
      readAccess: uniq([...this.editForm.value.readAccess, ...this.editForm.value.notifications]),
    };
    this.externalErrors = [];
    try {
      if (!updates.external) delete updates.external;
      if (updates.external) updates.external = JSON.parse(updates.external);
    } catch (e: any) {
      this.externalErrors.push(e.message);
    }
    (this.user
      ? this.users.update(updates)
      : this.users.create(updates)).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(cursor => {
      this.user = updates;
      this.user.modifiedString = cursor;
      this.user.modified = DateTime.fromISO(cursor);
      this.serverError = [];
      this.editing = false;
      this.init();
    });
  }

  copy$ = () => {
    return this.users.create({
      ...this.user!,
      origin: this.store.account.origin,
    }).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    );
  }

  delete$ = () => {
    this.serverError = [];
    const os = [];
    if (this.user) {
      const deleteNotice = !isDeletorTag(this.user.tag) && this.admin.getPlugin('plugin/delete')
        ? this.users.create(tagDeleteNotice(this.user))
        : of(null);
      os.push(this.users.delete(this.qualifiedTag).pipe(
        tap(() => this.deleted = true),
        switchMap(() => deleteNotice),
        catchError((err: HttpErrorResponse) => {
          this.serverError = printError(err);
          return throwError(() => err);
        }),
      ));
    }
    if (this.profile) {
      os.push(this.profiles.delete(this.qualifiedTag).pipe(
        catchError((err: HttpErrorResponse) => {
          this.serverError.push(...printError(err));
          return throwError(() => err);
        }),
      ));
    }
    return forkJoin(os).pipe(
      tap(() => this.deleted = true),
    );
  }

  keygen$ = () => {
    this.serverError = [];
    return this.users.keygen(this.qualifiedTag).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError.push(...printError(err));
        return throwError(() => err);
      }),
      switchMap(() => this.users.get(this.qualifiedTag)),
      tap(user => {
        this.user = user;
        this.serverError = [];
        this.genKey = false;
        this.init();
      })
    );
  }
}
