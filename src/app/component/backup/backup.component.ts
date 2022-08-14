import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AdminService } from '../../service/admin.service';
import { BackupService } from '../../service/api/backup.service';
import { Store } from '../../store/store';
import { printError } from '../../util/http';

@Component({
  selector: 'app-backup',
  templateUrl: './backup.component.html',
  styleUrls: ['./backup.component.scss']
})
export class BackupComponent implements OnInit {

  @Input()
  id!: string;

  restoring = false;
  deleting = false;
  @HostBinding('class.deleted')
  deleted = false;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    public backups: BackupService,
    public store: Store,
  ) { }

  ngOnInit(): void {
  }

  get inProgress() {
    return this.id.startsWith('_');
  }

  get downloadLink() {
    var link = this.backups.base + '/' + this.id;
    if (link.startsWith('//')) link = location.protocol + link;
    if (link.startsWith("_")) link = link.substring(1);
    if (!link.endsWith(".zip")) link = link + '.zip';
    return link;
  }

  restore() {
    this.backups.restore(this.id).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(() => {
      this.serverError = [];
        this.restoring = false;
    });
  }

  delete() {
    this.backups.delete(this.id).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(() => {
      this.serverError = [];
      this.deleted = true;
    });
  }

}
