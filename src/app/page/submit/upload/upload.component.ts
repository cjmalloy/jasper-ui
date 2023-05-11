import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { defer, delay, pick } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import * as moment from 'moment';
import { catchError, firstValueFrom, forkJoin, of, switchMap, throwError } from 'rxjs';
import { v4 as uuid } from 'uuid';
import * as XLSX from 'xlsx';
import { Ext, mapTag } from '../../../model/ext';
import { mapRef, Ref } from '../../../model/ref';
import { ExtService } from '../../../service/api/ext.service';
import { RefService } from '../../../service/api/ref.service';
import { ScrapeService } from '../../../service/api/scrape.service';
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
    private scraper: ScrapeService,
    private auth: AuthzService,
    private router: Router,
    private theme: ThemeService,
  ) {
    theme.setTitle($localize`Submit: Upload`);
    this.disposers.push(autorun(() => {
      this.readUploads(this.store.submit.files);
      defer(() => this.store.submit.clearFiles());
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  readUploads(uploads?: File[]) {
    if (!uploads) return;
    const files: File[] = [];
    const audio: File[] = [];
    const video: File[] = [];
    const images: File[] = [];
    const texts: File[] = [];
    const tables: File[] = [];
    for (let i = 0; i < uploads.length; i++) {
      const file = uploads[i];
      if (file.type === 'application/json' || file.type === 'application/zip') {
        files.push(file);
      }
      if (file.type.startsWith('audio/')) {
        audio.push(file);
      }
      if (file.type.startsWith('video/')) {
        video.push(file);
      }
      if (file.type.startsWith('image/')) {
        images.push(file);
      }
      if (file.type.startsWith('text/plain')) {
        texts.push(file);
      }
      if ([
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.oasis.opendocument.spreadsheet',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ].includes(file.type)) {
        tables.push(file);
      }
    }
    this.read(files);
    this.readScrape(audio, 'plugin/audio', this.store.account.localTag);
    this.readScrape(video, 'plugin/video', 'plugin/thumbnail', this.store.account.localTag);
    this.readScrape(images, 'plugin/image', 'plugin/thumbnail', this.store.account.localTag);
    this.readData(texts, this.store.account.localTag);
    this.readSheet(tables, 'plugin/table', this.store.account.localTag);
  }

  read(files?: File[]) {
    if (!files) return;
    for (let i = 0; i < files?.length; i++) {
      const file = files[i];
      this.getModels(file)
        .then(models => {
          models.ref?.forEach(ref => this.refs.count({ url: ref.url }).subscribe(count  => {
            if (count) {
              this.store.submit.foundRef(ref.url);
              // @ts-ignore
              this.refs.get(ref.url, ref.origin).subscribe(diff => this.store.submit.diffRef(diff));
            }
          }));
          models.ext?.forEach(ext => this.exts.count({ query: ext.tag }).subscribe(count  => {
            if (count) {
              this.store.submit.foundExt(ext.tag);
              // @ts-ignore
              this.exts.get(ext.tag + ext.origin).subscribe(diff => this.store.submit.diffExt(diff));
            }
          }));
          return models;
        })
        .then(models => {
          this.store.submit.addExts(...(models.ext || []));
          this.store.submit.addRefs(...(models.ref || []));
        })
        .catch(() => null);
    }
  }

  readScrape(files: File[], tag: string, ...extraTags: string[]) {
    if (!files) return;
    for (let i = 0; i < files?.length; i++) {
      const file = files[i];
      this.scraper.cache(file).subscribe(url => runInAction(() => this.store.submit.addRefs({
        upload: true,
        url,
        title: file.name,
        tags: ['public', tag, ...extraTags],
        published: moment(),
      })));
    }
  }

  readUrlPlugin(files: File[], tag: string, ...extraTags: string[]) {
    if (!files) return;
    for (let i = 0; i < files?.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => runInAction(() => this.store.submit.addRefs({
        upload: true,
        url: 'internal:' + uuid(),
        title: file.name,
        tags: ['public', tag, ...extraTags],
        plugins: { [tag]: { url: reader.result as string } },
        published: moment(),
      }));
      reader.readAsDataURL(file);
    }
  }

  readData(files: File[], ...extraTags: string[]) {
    if (!files) return;
    for (let i = 0; i < files?.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => runInAction(() => this.store.submit.addRefs({
        upload: true,
        url: 'internal:' + uuid(),
        title: file.name,
        tags: ['public', ...extraTags],
        comment: reader.result as string,
        published: moment(),
      }));
      reader.readAsText(file);
    }
  }

  readSheet(files: File[], ...extraTags: string[]) {
    if (!files) return;
    for (let i = 0; i < files?.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => runInAction(() => {
        const wb = XLSX.read(reader.result);
        for (const sheet of wb.SheetNames) {
          const title = wb.SheetNames.length === 1 ? file.name : `${file.name} [${sheet}]`;
          const comment = XLSX.utils.sheet_to_csv(wb.Sheets[sheet]);
          this.store.submit.addRefs({
            upload: true,
            url: 'internal:' + uuid(),
            title,
            tags: ['public', ...extraTags],
            comment,
            published: moment(),
          });
        }
      });
      reader.readAsArrayBuffer(file);
    }
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
