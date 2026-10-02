import { HttpErrorResponse } from '@angular/common/http';
import { FakeLinkDirective } from '../../directive/fake-link.directive';
import {
  Component,
  ChangeDetectionStrategy,
  effect,
  input,
  linkedSignal,
  signal,
  viewChild,
  viewChildren,
  computed,
  untracked
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { defer, uniq } from 'lodash-es';
import { DateTime } from 'luxon';
import { catchError, forkJoin, of, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { TitleDirective } from '../../directive/title.directive';
import { userForm, UserFormComponent } from '../../form/user/user.component';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Ext } from '../../model/ext';
import { getRole, Profile } from '../../model/profile';
import { Ref } from '../../model/ref';
import { Role, User } from '../../model/user';
import { isDeletorTag, tagDeleteNotice } from '../../mods/delete';
import { cronPlugin } from '../../mods/system/script';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { ProfileService } from '../../service/api/profile.service';
import { UserService } from '../../service/api/user.service';
import { AuthzService } from '../../service/authz.service';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';
import { downloadRef, downloadTag } from '../../util/download';
import { scrollToFirstInvalid } from '../../util/form';
import { printError } from '../../util/http';
import { localTag, subOrigin, tagOrigin } from '../../util/tag';
import { ActionComponent } from '../action/action.component';
import { ConfirmActionComponent } from '../action/confirm-action/confirm-action.component';
import { InlineButtonComponent } from '../action/inline-button/inline-button.component';
import { InlinePasswordComponent } from '../action/inline-password/inline-password.component';
import { InlineSelectComponent } from '../action/inline-select/inline-select.component';

@Component({
  selector: 'app-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss'],
  host: {
    'class': 'profile list-item',
    'tabindex': '0',
    '[class.deleted]': 'deleted',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FakeLinkDirective, RouterLink, TitleDirective, ConfirmActionComponent, InlineButtonComponent, InlinePasswordComponent, InlineSelectComponent, ReactiveFormsModule, UserFormComponent]
})
export class UserComponent implements HasChanges {
  readonly actionComponents = viewChildren<ActionComponent>('action');

  readonly profileInput = input<Profile | undefined>(undefined, { alias: 'profile' });
  readonly userInput = input<User | undefined>(undefined, { alias: 'user' });
  private readonly _profile = linkedSignal(() => this.profileInput());
  private readonly _user = linkedSignal(() => this.userInput());
  private readonly _ext = signal<Ext | undefined>(undefined);
  private readonly _deleted = signal(false);
  private readonly _writeAccess = signal(false);
  private readonly _serverError = signal<string[]>([]);
  private readonly _externalErrors = signal<string[]>([]);
  private readonly _genKey = signal(false);

  get profile() { return this._profile(); }
  set profile(value: Profile | undefined) { this._profile.set(value); }
  get user() { return this._user(); }
  set user(value: User | undefined) { this._user.set(value); }
  readonly refForm = viewChild<UserFormComponent>('refForm');

  editForm: UntypedFormGroup;
  get ext() { return this._ext(); }
  set ext(value: Ext | undefined) { this._ext.set(value); }
  submitted = false;
  editing = false;
  viewSource = false;
  get genKey() { return this._genKey(); }
  set genKey(value: boolean) { this._genKey.set(value); }
  get deleted() { return this._deleted(); }
  set deleted(value: boolean) { this._deleted.set(value); }
  get writeAccess() { return this._writeAccess(); }
  set writeAccess(value: boolean) { this._writeAccess.set(value); }
  get serverError() { return this._serverError(); }
  set serverError(value: string[]) { this._serverError.set(value); }
  get externalErrors() { return this._externalErrors(); }
  set externalErrors(value: string[]) { this._externalErrors.set(value); }

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
    effect(() => {
      this.userInput();
      this.profileInput();
      untracked(() => this.init());
    });
    this.editForm = userForm(fb, true);
    effect(() => {
      const refForm = this.refForm();
      const user = this.user;
      if (user) defer(() => refForm?.setUser(user));
    });
  }

  saveChanges() {
    return !this.editing || !this.editForm.dirty;
  }

  init() {
    this.actionComponents()?.forEach(c => c.reset());
    this.writeAccess = this.auth.tagWriteAccess(this.qualifiedTag()) && this.auth.hasRole(this.role());
    if (this.created() && !this.profile) {
      this.exts.getCachedExt(this.user!.tag, this.user!.origin)
        .subscribe(x => this.ext = x);
      this.profiles.getProfile(this.qualifiedTag())
        .subscribe(profile => this.profile = profile);
    }
  }

  readonly created = computed(() => {
    return this.user?.modified;
  });
  readonly qualifiedTag = computed(() => {
    return this.profile?.tag || (this.user!.tag + this.user!.origin);
  });
  readonly localTag = computed(() => {
    return localTag(this.profile?.tag) || this.user!.tag;
  });
  readonly origin = computed(() => {
    return tagOrigin(this.profile?.tag) || this.user?.origin || '';
  });
  readonly recommendedAlias = computed(() => {
    const api = new URL(this.config.api, location.href);
    const firstPath = api.pathname.split('/').filter(Boolean)[0];
    return firstPath?.startsWith('~') && firstPath.length > 1
      ? '@' + firstPath.substring(1)
      : '@' + api.hostname;
  });
  readonly local = computed(() => {
    return this.profile?.tag || (!this.user || this.user?.origin === this.store.account.origin);
  });
  readonly role = computed(() => {
    return getRole(this.profile?.role, this.user?.role);
  });

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

  get connectionRef(): Ref {
    const template = this.store.origins.origins.find(ref =>
      subOrigin(ref.origin, ref.plugins?.['+plugin/origin']?.local) === this.origin());
    const local = template?.plugins?.['+plugin/origin']?.remote || this.origin() || this.recommendedAlias();
    return {
      url: template?.url || new URL(this.config.api, document.baseURI).href,
      title: template?.title || local,
      tags: ['public', 'internal', '+plugin/cron', '+plugin/origin/pull', '+plugin/origin/tunnel'],
      plugins: {
        '+plugin/cron': { ...cronPlugin.defaults },
        '+plugin/origin': { remote: this.origin(), local },
        '+plugin/origin/tunnel': { remoteUser: this.qualifiedTag() },
      },
    };
  }

  connect() {
    downloadRef(this.connectionRef);
  }

  setPassword$ = (password: string) => {
    return this.profiles.changePassword({ tag: this.qualifiedTag(), password }).pipe(
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
      return this.profiles.changeRole({ tag: this.qualifiedTag(), role }).pipe(
        switchMap(() => this.profiles.getProfile(this.qualifiedTag())),
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
      const user = { ...(this.user || { tag: this.qualifiedTag() }), role };
      this.user = user;
      return this.users.update(user).pipe(
        tap(cursor => {
          this.user = { ...this.user!, modifiedString: cursor, modified: DateTime.fromISO(cursor) };
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
    return this.profiles.activate(this.qualifiedTag()).pipe(
      switchMap(() => this.profiles.getProfile(this.qualifiedTag())),
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
    return this.profiles.deactivate(this.qualifiedTag()).pipe(
      switchMap(() => this.profiles.getProfile(this.qualifiedTag())),
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
      tag: this.localTag(),
      origin: this.origin(),
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
      this.editForm.reset();
      this.user = { ...updates, modifiedString: cursor, modified: DateTime.fromISO(cursor) };
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
      os.push(this.users.delete(this.qualifiedTag()).pipe(
        tap(() => this.deleted = true),
        switchMap(() => deleteNotice),
        catchError((err: HttpErrorResponse) => {
          this.serverError = printError(err);
          return throwError(() => err);
        }),
      ));
    }
    if (this.profile) {
      os.push(this.profiles.delete(this.qualifiedTag()).pipe(
        catchError((err: HttpErrorResponse) => {
          this.serverError = [...this.serverError, ...printError(err)];
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
    return this.users.keygen(this.qualifiedTag()).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = [...this.serverError, ...printError(err)];
        return throwError(() => err);
      }),
      switchMap(() => this.users.get(this.qualifiedTag())),
      tap(user => {
        this.user = user;
        this.serverError = [];
        this.genKey = false;
        this.init();
      })
    );
  }
}
