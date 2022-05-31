import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, Observable, switchMap, throwError } from 'rxjs';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ProfileService } from '../../service/api/profile.service';
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
  tag!: string;
  @Input()
  roles: string[] = [];

  changingPassword = false;
  changingRole = false;
  deleting = false;
  @HostBinding('class.deleted')
  deleted = false;
  writeAccess$?: Observable<boolean>;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    public account: AccountService,
    private router: Router,
    private profiles: ProfileService,
  ) { }

  ngOnInit(): void {
    this.writeAccess$ = this.account.tagWriteAccess(this.tag, 'user');
    this.profiles.getRoles(this.tag).subscribe(roles => this.roles = roles);
  }

  setInlinePassword() {
    if (!this.inlinePassword) return;
    const password = (this.inlinePassword.nativeElement.value as string);
    this.profiles.changePassword({ tag: this.tag, password }).pipe(
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
    this.profiles.changeRole({ tag: this.tag, role }).pipe(
      switchMap(() => this.profiles.getRoles(this.tag)),
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(roles => {
      this.changingRole = false;
      this.roles = roles;
    });
  }

  delete() {
    this.profiles.delete(this.tag).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.deleted = true;
    });
  }
}
