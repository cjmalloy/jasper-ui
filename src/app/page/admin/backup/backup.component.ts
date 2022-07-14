import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { BackupService } from '../../../service/api/backup.service';
import { ThemeService } from '../../../service/theme.service';
import { printError } from '../../../util/http';

@Component({
  selector: 'app-admin-backup-page',
  templateUrl: './backup.component.html',
  styleUrls: ['./backup.component.scss']
})
export class AdminBackupPage implements OnInit {

  list?: string[];
  serverError: string[] = [];

  constructor(
    private theme: ThemeService,
    private route: ActivatedRoute,
    private backups: BackupService,
  ) {
    theme.setTitle('Admin: Backup & Restore');
    backups.list()
      .subscribe(list => this.list = list);
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
      this.list?.push(id);
    });
  }

  upload(files?: FileList) {
    this.serverError = [];
    if (!files || !files.length) return;
    this.backups.upload(files[0]).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(id => this.list?.push(id));
  }

  showUpload() {
    document.getElementById('upload')!.click()
  }
}
