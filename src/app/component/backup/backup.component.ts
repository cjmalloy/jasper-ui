import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { BackupService } from '../../service/api/backup.service';
import { printError } from '../../util/http';

@Component({
  selector: 'app-backup',
  templateUrl: './backup.component.html',
  styleUrls: ['./backup.component.scss']
})
export class BackupComponent implements OnInit {

  @Input()
  id!: string;

  deleting = false;
  @HostBinding('class.deleted')
  deleted = false;
  serverError: string[] = [];

  constructor(
    public backups: BackupService,
  ) { }

  ngOnInit(): void {
  }

  get inProgress() {
    return this.id.startsWith('_');
  }

  get downloadLink() {
    var link = this.backups.base + '/' + this.id;
    if (link.startsWith('//')) link = location.protocol + link;
    if (!link.endsWith(".zip")) link = link + '.zip';
    return link;
  }

  restore() {
    this.backups.restore(this.id)
      .subscribe();
  }

  delete() {
    this.backups.delete(this.id).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.deleted = true;
    });
  }

}
