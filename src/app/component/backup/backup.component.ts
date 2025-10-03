import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, HostBinding, Input, Output } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { BackupOptions } from '../../model/backup';
import { AdminService } from '../../service/admin.service';
import { BackupService } from '../../service/api/backup.service';
import { Store } from '../../store/store';
import { readableBytes } from '../../util/format';
import { printError } from '../../util/http';

@Component({
  standalone: false,
  selector: 'app-backup',
  templateUrl: './backup.component.html',
  styleUrls: ['./backup.component.scss']
})
export class BackupComponent {

  @Input()
  id!: string;
  @Input()
  size? = 0;
  @Input()
  origin = '';

  @Output()
  restoreRequested = new EventEmitter<void>();

  @HostBinding('class.deleted')
  deleted = false;
  serverError: string[] = [];

  private backupKey = '';

  constructor(
    public admin: AdminService,
    public backups: BackupService,
    public store: Store,
  ) {
    backups.getDownloadKey()
      .subscribe(key => this.backupKey = key);
  }

  get inProgress() {
    return this.id.startsWith('_');
  }

  get fileSize() {
    return readableBytes(this.size || 0);
  }

  get downloadLink() {
    var link = this.backups.base + '/' + this.id;
    if (link.startsWith('//')) link = location.protocol + link;
    if (link.startsWith("_")) link = link.substring(1);
    if (!link.endsWith(".zip")) link = link + '.zip';
    if (this.origin) link += '?origin=' + encodeURIComponent(this.origin)
    return link;
  }

  get downloadLinkAuth() {
    return this.downloadLink + (this.origin ? '&' : '?') + 'p=' + encodeURIComponent(this.backupKey);
  }

  requestRestore() {
    this.restoreRequested.emit();
  }

  performRestore(options: BackupOptions) {
    return this.backups.restore(this.origin, this.id, options).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
      tap(() => {
        this.serverError = [];
      }),
    ).subscribe();
  }

  delete$ = () => {
    return this.backups.delete(this.origin, this.id).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
      tap(() => {
        this.serverError = [];
        this.deleted = true;
      }),
    );
  }

}
