import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, HostBinding, Output } from '@angular/core';
import { Router } from '@angular/router';
import { delay } from 'lodash-es';
import { catchError, firstValueFrom, forkJoin, of, throwError } from 'rxjs';
import { Ext } from '../../model/ext';
import { Ref } from '../../model/ref';
import { ExtService } from '../../service/api/ext.service';
import { RefService } from '../../service/api/ref.service';
import { printError } from '../../util/http';
import { getModels, getZipOrTextFile } from '../../util/zip';

@Component({
  selector: 'app-upload-ref',
  templateUrl: './upload-ref.component.html',
  styleUrls: ['./upload-ref.component.scss']
})
export class UploadRefComponent {
  @HostBinding('class') css = 'form-array';

  @Output()
  serverErrors = new EventEmitter<string[]>();

  serverError: string[] = [];
  processing = false;

  constructor(
    private refs: RefService,
    private exts: ExtService,
    private router: Router,
  ) { }

  readRefs(files?: FileList) {
    this.serverError = [];
    const file = files?.[0];
    if (!file) return;
    getZipOrTextFile(file, 'ext.json')
      .then(json => getModels<Ext>(json))
      .then(exts => firstValueFrom(forkJoin(exts.map(ext => this.uploadExt(ext)))))
      .then(() => getZipOrTextFile(file, 'ref.json'))
      .then(json => getModels<Ref>(json))
      .then(refs => firstValueFrom(forkJoin(refs.map(ref => this.uploadRef(ref)))))
      .then(() => delay(() => this.router.navigate(['/tag', '*'], { queryParams: { sort: 'modified,DESC' } }),
        1000))
      .catch(() => null);
  }

  uploadRef(ref: Ref) {
    // @ts-ignore
    if (ref.tag) return of(null);
    return this.refs.create(ref).pipe(
      catchError((res: HttpErrorResponse) => {
        if (res.status === 409) {
          return this.refs.update(ref);
        }
        return throwError(() => res);
      }),
      catchError((res: HttpErrorResponse) => {
        this.serverErrors.next(this.serverError = [...this.serverError, ...printError(res)]);
        return of(null);
      }),
    );
  }

  uploadExt(ext: Ext) {
    if (!ext.tag) return of(null);
    return this.exts.create(ext).pipe(
      catchError((res: HttpErrorResponse) => {
        if (res.status === 409) {
          return this.exts.update(ext);
        }
        return throwError(() => res);
      }),
      catchError((res: HttpErrorResponse) => {
        this.serverErrors.next(this.serverError = [...this.serverError, ...printError(res)]);
        return of(null);
      }),
    );
  }
}
