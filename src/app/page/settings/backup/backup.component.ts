import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { BackupService } from '../../../service/api/backup.service';
import { ThemeService } from '../../../service/theme.service';
import { Store } from '../../../store/store';
import { printError } from '../../../util/http';

@Component({
  selector: 'app-settings-backup-page',
  templateUrl: './backup.component.html',
  styleUrls: ['./backup.component.scss']
})
export class SettingsBackupPage implements OnInit {

  list?: string[];
  uploading = false;
  serverError: string[] = [];

  constructor(
    private theme: ThemeService,
    private route: ActivatedRoute,
    public store: Store,
    private backups: BackupService,
  ) {
    theme.setTitle($localize`Settings: Backup & Restore`);
    backups.list()
      .subscribe(list => this.list = list.sort().reverse());
  }

  ngOnInit(): void {
  }

  backup() {
    this.serverError = [];
    this.backups.create().pipe(
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
    this.backups.upload(file).pipe(
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
}
