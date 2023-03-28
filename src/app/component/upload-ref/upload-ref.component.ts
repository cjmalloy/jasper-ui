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
import { getModels, getTextFile, unzip, zippedFile } from '../../util/zip';

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
    let refs: Ref[] = [];
    let exts: Ext[] = []
    this.getModels(file)
      .then(models => {
        exts = models.exts;
        refs = models.refs;
        const uploads = [
          ...exts.map(ext => this.uploadExt(ext)),
          ...refs.map(ref => this.uploadRef(ref)),
        ];
        return firstValueFrom(forkJoin(uploads));
      })
      .then(() => delay(() => this.postNavigate(exts, refs), 1000))
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

  private getModels(file: File): Promise<{ refs: Ref[], exts: Ext[]}> {
    if (file.name.toLowerCase().endsWith('.zip')) {
      return unzip(file).then(zip => Promise.all([
          zippedFile(zip, 'ext.json')
            .then(json => getModels<Ext>(json)),
          zippedFile(zip, 'ref.json')
            .then(json => getModels<Ref>(json))
        ]))
        .then(([exts, refs]) => ({ exts, refs }));
    } else {
      return getTextFile(file)
        .then(json => getModels<Ext|Ref>(json))
        .then(models => ({
          exts: models.filter(m => 'tag' in m) as Ext[],
          refs: models.filter(m => 'url' in m) as Ref[],
        }));
    }
  }

  private postNavigate(exts: Ext[], refs: Ref[]) {
    if (refs.length === 1) {
      return this.router.navigate(['/ref', refs[0].url]);
    }
    if (refs.length) {
      return this.router.navigate(['/tag', '*'], { queryParams: { sort: 'modified,DESC' } });
    }
    if (exts.length === 1) {
      return this.router.navigate(['/tag', exts[0].tag]);
    }
    if (exts.length) {
      return this.router.navigate(['/settings', 'ext'], { queryParams: { sort: 'modified,DESC' } });
    }
    return null;
  }
}
