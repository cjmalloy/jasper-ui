import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import * as moment from 'moment';
import { catchError, throwError } from 'rxjs';
import { BackupService } from '../../../service/api/backup.service';
import { OriginService } from '../../../service/api/origin.service';
import { ThemeService } from '../../../service/theme.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { ORIGIN_REGEX } from '../../../util/format';
import { printError } from '../../../util/http';

@Component({
  selector: 'app-settings-backup-page',
  templateUrl: './backup.component.html',
  styleUrls: ['./backup.component.scss']
})
export class SettingsBackupPage implements OnInit {
  @HostBinding('class') css = 'backup';
  originPattern = ORIGIN_REGEX.source;

  submitted = false;
  originForm: UntypedFormGroup;

  origin = this.store.account.origin;
  list?: string[];
  uploading = false;
  serverError: string[] = [];

  constructor(
    private theme: ThemeService,
    public store: Store,
    private backups: BackupService,
    private origins: OriginService,
    private fb: UntypedFormBuilder,
  ) {
    theme.setTitle($localize`Settings: Backup & Restore`);
    backups.list(this.origin)
      .subscribe(list => this.list = list.sort().reverse());
    this.originForm = fb.group({
      origin: ['', [Validators.pattern(ORIGIN_REGEX)]],
      olderThan: [moment().format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS)],
    });
  }

  ngOnInit(): void {
  }

  backup() {
    this.serverError = [];
    this.backups.create(this.origin).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(id => {
      this.list?.unshift('_' + id);
    });
  }

  upload(files?: FileList) {
    this.serverError = [];
    if (!files || !files.length) return;
    this.uploading = true;
    const file = files[0]!;
    this.backups.upload(this.origin, file).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        this.uploading = false;
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.uploading = false;
      this.list?.unshift(files[0].name);
    });
  }

  backfill() {
    this.serverError = [];
    this.backups.backfill(this.origin).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe();
  }

  deleteOrigin() {
    this.serverError = [];
    this.submitted = true;
    this.originForm.markAllAsTouched();
    if (!this.originForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const origin = this.originForm.value.origin;
    const olderThan = moment(this.originForm.value.olderThan, moment.HTML5_FMT.DATETIME_LOCAL_SECONDS);
    this.origins.delete(origin, olderThan).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.submitted = true;
    });
  }
}
