import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { delay, pick } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { catchError, firstValueFrom, forkJoin, of, switchMap, throwError } from 'rxjs';
import { Ext, mapTag } from '../../../model/ext';
import { mapRef, Ref } from '../../../model/ref';
import { ExtService } from '../../../service/api/ext.service';
import { RefService } from '../../../service/api/ref.service';
import { AuthzService } from '../../../service/authz.service';
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
  processing = false;

  constructor(
    public store: Store,
    private refs: RefService,
    private exts: ExtService,
    private auth: AuthzService,
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

  read(files?: FileList) {
    const file = files?.[0];
    if (!file) return;
    this.getModels(file)
      .then(models => {
        models.ref?.forEach(ref => this.refs.count({ url: ref.url }).subscribe(count  => {
          if (count) {
            this.store.submit.foundRef(ref.url);
          }
        }));
        models.ext?.forEach(ext => this.exts.count({ query: ext.tag }).subscribe(count  => {
          if (count) {
            this.store.submit.foundExt(ext.tag);
          }
        }));
        return models;
      })
      .then(models => runInAction(() => {
        this.store.submit.exts = [...this.store.submit.exts, ...(models.ext || [])];
        this.store.submit.refs = [...this.store.submit.refs, ...(models.ref || [])];
      }))
      .catch(() => null);
    this.store.submit.setFiles([]);
  }

  setFiles(files?: FileList) {
    if (!files) return;
    this.store.submit.setFiles(files);
  }

  clear(upload: HTMLInputElement) {
    upload.value = '';
    this.store.submit.clearUpload();
  }

  push() {
    if (this.store.submit.empty) return;
    this.processing = true;
    const uploads = [
      ...this.store.submit.exts.map(ext => this.uploadExt(ext)),
      ...this.store.submit.refs.map(ref => this.uploadRef(ref)),
    ];
    return firstValueFrom(forkJoin(uploads))
      .then(() => delay(() => this.postNavigate(), 1000))
      .catch(() => null)
      .then(() => this.processing = false);
  }

  uploadRef(ref: Ref) {
    ref.tags = ref.tags?.filter(t => this.auth.canAddTag(t));
    ref.plugins = pick(ref.plugins as any, ref.tags as string[]);
    return this.refs.create({
      ...ref,
      origin: this.store.account.origin,
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        if (this.store.submit.overwrite) {
          return this.refs.get(ref.url, this.store.account.origin).pipe(
            switchMap(old => this.refs.push({
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
        if (this.store.submit.overwrite) {
          return this.exts.get(ext.tag + this.store.account.origin).pipe(
            switchMap(old => this.exts.push({
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
    if (this.store.submit.refs.length === 1) {
      return this.router.navigate(['/ref', this.store.submit.refs[0].url]);
    }
    if (this.store.submit.refs.length) {
      return this.router.navigate(['/tag', '*'], { queryParams: { sort: 'modified,DESC' } });
    }
    if (this.store.submit.exts.length === 1) {
      return this.router.navigate(['/tag', this.store.submit.exts[0].tag]);
    }
    if (this.store.submit.exts.length) {
      return this.router.navigate(['/settings', 'ext'], { queryParams: { sort: 'modified,DESC' } });
    }
    return null;
  }

  protected readonly console = console;
}
