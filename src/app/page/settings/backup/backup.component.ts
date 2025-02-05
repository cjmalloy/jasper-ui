import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { sortBy } from 'lodash-es';
import { DateTime } from 'luxon';
import { catchError, throwError } from 'rxjs';
import { BackupRef, BackupService } from '../../../service/api/backup.service';
import { OriginService } from '../../../service/api/origin.service';
import { ModService } from '../../../service/mod.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { ORIGIN_REGEX } from '../../../util/format';
import { printError } from '../../../util/http';

@Component({
  standalone: false,
  selector: 'app-settings-backup-page',
  templateUrl: './backup.component.html',
  styleUrls: ['./backup.component.scss'],
  host: {'class': 'backup'}
})
export class SettingsBackupPage {
  originPattern = ORIGIN_REGEX.source;

  submitted = false;
  originForm: UntypedFormGroup;

  origin = this.store.account.origin;
  list?: BackupRef[];
  uploading = false;
  serverError: string[] = [];

  constructor(
    private mod: ModService,
    public store: Store,
    private backups: BackupService,
    private origins: OriginService,
    private fb: UntypedFormBuilder,
  ) {
    mod.setTitle($localize`Settings: Backup & Restore`);
    backups.list(this.origin)
      .subscribe(list => this.list = sortBy(list, 'id').reverse());
    this.originForm = fb.group({
      origin: ['', [Validators.pattern(ORIGIN_REGEX)]],
      olderThan: [DateTime.now().toISO()],
    });
  }

  backup() {
    this.serverError = [];
    this.backups.create(this.origin).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(id => {
      this.list?.unshift({ id: '_' + id });
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
      this.list?.unshift({ id: files[0].name });
    });
  }

  regen() {
    this.serverError = [];
    this.backups.regen(this.origin).pipe(
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
    const olderThan = DateTime.fromISO(this.originForm.value.olderThan);
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
