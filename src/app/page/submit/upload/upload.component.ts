import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { delay } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { catchError, firstValueFrom, forkJoin, of, switchMap, throwError } from 'rxjs';
import { Ext, mapTag } from '../../../model/ext';
import { mapRef, Ref } from '../../../model/ref';
import { ExtService } from '../../../service/api/ext.service';
import { RefService } from '../../../service/api/ref.service';
import { ThemeService } from '../../../service/theme.service';
import { Store } from '../../../store/store';
import { printError } from '../../../util/http';
import { FilteredModels, filterModels, getModels, getTextFile, unzip, zippedFile } from '../../../util/zip';

@Component({
  selector: 'app-upload',
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.scss']
})
export class UploadPage implements OnDestroy {
  private disposers: IReactionDisposer[] = [];

  serverErrors: string[] = [];
  rs: Ref[] = [];
  es: Ext[] = [];
  processing = false;
  overwrite = false;

  constructor(
    private store: Store,
    private refs: RefService,
    private exts: ExtService,
    private router: Router,
    private theme: ThemeService,
  ) {
    theme.setTitle($localize`Submit: Upload`);
    this.disposers.push(autorun(() => this.read(this.store.submit.files)))
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  get empty() {
    return !this.es.length && !this.rs.length;
  }

  read(files?: FileList) {
    this.rs = [];
    this.es = [];
    const file = files?.[0];
    if (!file) return;
    this.getModels(file)
      .then(models => {
        this.es = models.ext || [];
        this.rs = models.ref || [];
      })
      .catch(() => null);
  }

  setFiles(files?: FileList) {
    if (!files) return;
    runInAction(() => this.store.submit.files = files);
  }

  clear() {
    runInAction(() => this.store.submit.files = [] as any);
  }

  push() {
    if (this.empty) return;
    this.processing = true;
    const uploads = [
      ...this.es.map(ext => this.uploadExt(ext)),
      ...this.rs.map(ref => this.uploadRef(ref)),
    ];
    return firstValueFrom(forkJoin(uploads))
      .then(() => delay(() => this.postNavigate(), 1000))
      .catch(() => null)
      .then(() => this.processing = false);
  }

  uploadRef(ref: Ref) {
    return this.refs.create({
      ...ref,
      origin: this.store.account.origin,
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        if (res.status === 409 && this.overwrite) {
          return this.refs.get(ref.url, this.store.account.origin).pipe(
            switchMap(old => this.refs.update({
              ...ref,
              origin: this.store.account.origin,
              modifiedString: old.modifiedString,
            })));
        }
        return throwError(() => res);
      }),
      catchError((res: HttpErrorResponse) => {
        this.serverErrors.push(...printError(res));
        return of(null);
      }),
    );
  }

  uploadExt(ext: Ext) {
    return this.exts.create({
      ...ext,
      origin: this.store.account.origin,
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        if (res.status === 409 && this.overwrite) {
          return this.exts.get(ext.tag + this.store.account.origin).pipe(
            switchMap(old => this.exts.update({
              ...ext,
              origin: this.store.account.origin,
              modifiedString: old.modifiedString,
            })));
        }
        return throwError(() => res);
      }),
      catchError((res: HttpErrorResponse) => {
        this.serverErrors.push(...printError(res));
        return of(null);
      }),
    );
  }

  private getModels(file: File): Promise<FilteredModels> {
    if (file.name.toLowerCase().endsWith('.zip')) {
      return unzip(file).then(zip => Promise.all([
        zippedFile(zip, 'ext.json')
          .then(json => getModels<Ext>(json))
          .then(exts => exts.map(mapTag)),
        zippedFile(zip, 'ref.json')
          .then(json => getModels<Ref>(json))
          .then(refs => refs.map(mapRef)),
      ]))
        .then(([ext, ref]) => ({ ext, ref }));
    } else {
      return getTextFile(file)
        .then(getModels)
        .then(filterModels);
    }
  }

  private postNavigate() {
    if (this.rs.length === 1) {
      return this.router.navigate(['/ref', this.rs[0].url]);
    }
    if (this.rs.length) {
      return this.router.navigate(['/tag', '*'], { queryParams: { sort: 'modified,DESC' } });
    }
    if (this.es.length === 1) {
      return this.router.navigate(['/tag', this.es[0].tag]);
    }
    if (this.es.length) {
      return this.router.navigate(['/settings', 'ext'], { queryParams: { sort: 'modified,DESC' } });
    }
    return null;
  }
}
