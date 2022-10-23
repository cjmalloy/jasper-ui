import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as _ from 'lodash-es';
import { catchError, forkJoin, throwError } from 'rxjs';
import { Ext } from '../../../model/ext';
import { Ref } from '../../../model/ref';
import { BackupService } from '../../../service/api/backup.service';
import { ExtService } from '../../../service/api/ext.service';
import { RefService } from '../../../service/api/ref.service';
import { ThemeService } from '../../../service/theme.service';
import { Store } from '../../../store/store';
import { printError } from '../../../util/http';
import { getModels, getTextFile, getZipFile } from '../../../util/zip';

@Component({
  selector: 'app-settings-backup-page',
  templateUrl: './backup.component.html',
  styleUrls: ['./backup.component.scss']
})
export class SettingsBackupPage implements OnInit {

  list?: string[];
  uploading = false;
  restoring = false;
  serverError: string[] = [];

  constructor(
    private theme: ThemeService,
    private route: ActivatedRoute,
    public store: Store,
    private backups: BackupService,
    private refs: RefService,
    private exts: ExtService,
  ) {
    theme.setTitle('Settings: Backup & Restore');
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

  restore(files?: FileList) {
    this.serverError = [];
    if (!files || !files.length) return;
    this.restoring = true;
    const restore = (p: Promise<any>) => p
      .catch(err => this.serverError.push(err))
      .then(() => this.restoring = false);
    const file = files[0]!;
    _.defer(() => {
      if (file.name.toLowerCase().endsWith('.zip')) {
        restore(getZipFile(file, 'ref.json')
          .then(json => getModels<Ref>(json))
          .then(refs => refs.map(r => this.uploadRef(r)))
          .then(() => getZipFile(file, 'ext.json'))
          .then(json => getModels<Ext>(json))
          .then(exts => exts.map(e => this.uploadExt(e))));
      } else if (file.name.startsWith('ref')) {
        restore(getTextFile(file)
          .then(json => getModels<Ref>(json))
          .then(refs => refs.map(r => this.uploadRef(r))));
      } else if (file.name.startsWith('ext')) {
        restore(getTextFile(file)
          .then(json => getModels<Ext>(json))
          .then(exts => exts.map(e => this.uploadExt(e))));
      }
    });
  }

  uploadRef(ref: Ref) {
    this.refs.create(ref).pipe(
      catchError((res: HttpErrorResponse) => {
        if (res.status === 409) {
          return this.refs.update(ref);
        }
        return throwError(() => res);
      }),
      catchError((res: HttpErrorResponse) => {
        this.serverError.push(...printError(res));
        return throwError(() => res);
      }),
    ).subscribe();
  }

  uploadExt(ext: Ext) {
    this.exts.create(ext).pipe(
      catchError((res: HttpErrorResponse) => {
        if (res.status === 409) {
          return this.exts.update(ext);
        }
        return throwError(() => res);
      }),
      catchError((res: HttpErrorResponse) => {
        this.serverError.push(...printError(res));
        return throwError(() => res);
      }),
    ).subscribe();
  }

  showUpload() {
    document.getElementById('upload')!.click()
  }

  showRestore() {
    document.getElementById('restore')!.click()
  }
}
