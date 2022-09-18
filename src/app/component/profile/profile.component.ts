import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { Profile } from '../../model/profile';
import { AdminService } from '../../service/admin.service';
import { ProfileService } from '../../service/api/profile.service';
import { AuthService } from '../../service/auth.service';
import { Store } from '../../store/store';
import { printError } from '../../util/http';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  @HostBinding('class') css = 'profile list-item';
  @HostBinding('attr.tabindex') tabIndex = 0;

  @ViewChild('inlinePassword')
  inlinePassword?: ElementRef;
  @ViewChild('inlineRole')
  inlineRole?: ElementRef;

  @Input()
  profile!: Profile;

  changingPassword = false;
  changingRole = false;
  deleting = false;
  @HostBinding('class.deleted')
  deleted = false;
  writeAccess = false;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    public store: Store,
    private router: Router,
    private auth: AuthService,
    private profiles: ProfileService,
  ) { }

  ngOnInit(): void {
    this.writeAccess = this.auth.tagWriteAccess(this.profile.tag);
  }

  get role() {
    return this.profile.role?.toLowerCase().replace('role_', '');
  }

  setInlinePassword() {
    if (!this.inlinePassword) return;
    const password = (this.inlinePassword.nativeElement.value as string);
    this.profiles.changePassword({ tag: this.profile.tag, password }).pipe(
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
    this.profiles.changeRole({ tag: this.profile.tag, role }).pipe(
      switchMap(() => this.profiles.getProfile(this.profile.tag)),
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
    this.profiles.activate(this.profile.tag).pipe(
      switchMap(() => this.profiles.getProfile(this.profile.tag)),
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(profile => {
      this.profile = profile;
    });
  }

  deactivate() {
    this.profiles.deactivate(this.profile.tag).pipe(
      switchMap(() => this.profiles.getProfile(this.profile.tag)),
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(profile => {
      this.profile = profile;
    });
  }

  delete() {
    this.profiles.delete(this.profile.tag).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.deleting = false;
      this.deleted = true;
    });
  }
}
