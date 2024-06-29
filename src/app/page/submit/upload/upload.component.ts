import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, OnDestroy } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { defer, delay, pick, uniq } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction, toJS } from 'mobx';
import * as moment from 'moment';
import { catchError, concat, lastValueFrom, map, of, switchMap, throwError } from 'rxjs';
import { v4 as uuid } from 'uuid';
import * as XLSX from 'xlsx';
import { Ext, mapTag } from '../../../model/ext';
import { mapRef, Ref } from '../../../model/ref';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { RefService } from '../../../service/api/ref.service';
import { ScrapeService } from '../../../service/api/scrape.service';
import { AuthzService } from '../../../service/authz.service';
import { BookmarkService } from '../../../service/bookmark.service';
import { ModService } from '../../../service/mod.service';
import { Store } from '../../../store/store';
import { downloadSet } from '../../../util/download';
import { TAGS_REGEX } from '../../../util/format';
import { printError } from '../../../util/http';
import { FilteredModels, filterModels, getModels, getTextFile, unzip, zippedFile } from '../../../util/zip';

@Component({
  selector: 'app-upload',
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.scss']
})
export class UploadPage implements OnDestroy {
  @HostBinding('class') css = 'full-page-upload';
  private disposers: IReactionDisposer[] = [];
  tagRegex = TAGS_REGEX.source;

  serverErrors: string[] = [];
  processing = false;
  webCache = this.admin.getPlugin('plugin/file');

  constructor(
    public store: Store,
    public bookmarks: BookmarkService,
    private mod: ModService,
    private admin: AdminService,
    private refs: RefService,
    private exts: ExtService,
    private scraper: ScrapeService,
    private auth: AuthzService,
    private router: Router,
    private fb: FormBuilder,
  ) {
    mod.setTitle($localize`Submit: Upload`);
    this.disposers.push(autorun(() => {
      this.readUploads(this.store.submit.files);
      defer(() => this.store.submit.clearFiles());
    }));
    this.store.submit.clearOverride();
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  readUploads(uploads?: File[]) {
    // TODO: process sequentially and show indicator
    if (!uploads) return;
    const files: File[] = [];
    const audio: File[] = [];
    const video: File[] = [];
    const images: File[] = [];
    const bookmarks: File[] = [];
    const sitemap: File[] = [];
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
      if (file.type.startsWith('text/html')) {
        bookmarks.push(file);
      }
      if (file.type.startsWith('text/xml') || file.type.startsWith('application/xml')) {
        sitemap.push(file);
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
    this.readScrape(audio, 'plugin/audio', this.store.account.localTag, ...this.store.submit.tags);
    this.readScrape(video, 'plugin/video', 'plugin/thumbnail', this.store.account.localTag, ...this.store.submit.tags);
    this.readScrape(images, 'plugin/image', 'plugin/thumbnail', this.store.account.localTag, ...this.store.submit.tags);
    this.readData(texts, this.store.account.localTag, ...this.store.submit.tags);
    this.readBookmarks(bookmarks, this.store.account.localTag, ...this.store.submit.tags);
    this.readSitemap(sitemap, this.store.account.localTag, ...this.store.submit.tags);
    this.readSheet(tables, 'plugin/table', this.store.account.localTag, ...this.store.submit.tags);
  }

  read(files?: File[], ...extraTags: string[]) {
    if (!files) return;
    for (let i = 0; i < files?.length; i++) {
      const file = files[i];
      this.getModels(file)
        .then(models => {
          if (models.ref?.length + models.ext?.length > this.store.submit.maxPreview) {
            // Bail on existence checks for huge archives
            return models;
          }
          models.ref?.forEach(ref => {
            ref.tags = uniq([...ref.tags || [], ...extraTags]);
            this.refs.count({ url: ref.url }).subscribe(count  => {
              if (count) {
                this.store.submit.foundRef(ref.url);
                // TODO: diff existing refs
                // this.refs.get(ref.url, ref.origin).subscribe(diff => this.store.submit.diffRef(diff));
              }
            })
          });
          models.ext?.forEach(ext => this.exts.count({ query: ext.tag }).subscribe(count => {
            if (count) {
              this.store.submit.foundExt(ext.tag);
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
      this.scraper.cache(file).pipe(
        map(ref => {
          ref.title = file.name;
          ref.tags = uniq([...ref.tags || [], tag, ...extraTags.filter(t => !!t)]);
          return ref;
        }),
      ).subscribe(ref => runInAction(() => this.store.submit.addRefs({ ...ref, upload: true })));
    }
  }

  cache(files: File[]) {
    if (!files) return;
    for (let i = 0; i < files?.length; i++) {
      const file = files[i];
      this.scraper.cache(file).subscribe(ref => runInAction(() => this.store.submit.addRefs({
        ...ref,
        upload: true,
        title: file.name,
        tags: uniq([...ref.tags || [], this.store.account.localTag, ...this.store.submit.tags, 'plugin/file']),
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
        tags: uniq(['public', tag, ...extraTags.filter(t => !!t)]),
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
        tags: uniq(['public', ...extraTags.filter(t => !!t)]),
        comment: reader.result as string,
        published: moment(),
      }));
      reader.readAsText(file);
    }
  }

  readBookmarks(files: File[], ...extraTags: string[]) {
    if (!files) return;
    for (let i = 0; i < files?.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => runInAction(() => {
        const html = reader.result as string;
        const links = new DOMParser().parseFromString(html, 'text/html').documentElement.getElementsByTagName('a');
        for (let i = 0; i < links.length; i++) {
          const a = links.item(i)!;
          this.store.submit.addRefs({
            upload: true,
            url: a.href,
            title: a.innerText,
            tags: ['public', ...extraTags.filter(t => !!t)],
            published: moment(),
          });
        }
      });
      reader.readAsText(file);
    }
  }

  readSitemap(files: File[], ...extraTags: string[]) {
    if (!files) return;
    for (let i = 0; i < files?.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => runInAction(() => {
        const xml = reader.result as string;
        const locs = new DOMParser().parseFromString(xml, 'application/xml').documentElement.getElementsByTagName('loc');
        for (let i = 0; i < locs.length; i++) {
          const loc = locs.item(i)?.textContent;
          if (!loc) continue;
          this.store.submit.addRefs({
            upload: true,
            url: loc,
            tags: ['public', ...extraTags.filter(t => !!t)],
            published: moment(),
          });
        }
      });
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
            tags: ['public', ...extraTags.filter(t => !!t)],
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

  download() {
    if (this.store.submit.empty) return;
    return downloadSet(this.store.submit.refs, this.store.submit.exts, 'uploads');
  }

  push() {
    if (this.processing || this.store.submit.empty) return;
    this.processing = true;
    const uploads = [
      ...this.store.submit.exts.map(ext => this.uploadExt$(ext)),
      ...this.store.submit.refs.map(ref => this.uploadRef$(ref)),
    ];
    return lastValueFrom(concat(...uploads))
      .then(() => delay(() => this.postNavigate(), 1000))
      .catch(() => null)
      .then(() => {
        this.store.submit.clearUpload();
        this.processing = false;
      });
  }

  uploadRef$(ref: Ref) {
    ref = toJS(ref);
    ref.tags = ref.tags?.filter(t => this.auth.canAddTag(t));
    ref.plugins = pick(ref.plugins, ref.tags || []);
    return (this.store.submit.overwrite
      ? this.refs.update({ ...ref, origin: this.store.account.origin }, true).pipe(
          catchError((err: HttpErrorResponse) => {
            if (err.status === 404) {
              return this.refs.create({ ...ref, origin: this.store.account.origin });
            }
            return throwError(() => err);
          }),
        )
      : this.refs.create({ ...ref, origin: this.store.account.origin })
    ).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 409 && this.store.submit.overwrite) {
          return this.refs.get(ref.url, this.store.account.origin).pipe(
            switchMap(existing => {
              return this.refs.update({ ...ref, modifiedString: existing.modifiedString }, true);
            }),
          );
        }
        return throwError(() => err);
      }),
      catchError((res: HttpErrorResponse) => {
        this.serverErrors.push(...printError(res));
        return of(null);
      }),
    );
  }

  uploadExt$(ext: Ext) {
    return (this.store.submit.overwrite
      ? this.exts.update({ ...ext, origin: this.store.account.origin }, true)
      : this.exts.create({ ...ext, origin: this.store.account.origin })).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 409 && this.store.submit.overwrite) {
          return this.exts.get(ext.tag + this.store.account.origin).pipe(
            switchMap(existing => {
              return this.exts.update({ ...ext, modifiedString: existing.modifiedString }, true);
            })
          );
        }
        return throwError(() => err);
      }),
      catchError((res: HttpErrorResponse) => {
        this.serverErrors.push(...printError(res));
        return of(null);
      }),
    );
  }

  tagAll(field: HTMLInputElement) {
    if (field.validity.patternMismatch) {
      field.setCustomValidity($localize`
        Tags must be lower case letters, numbers, periods and forward slashes.
        Must not start with a forward slash or period.
        Must not or contain two forward slashes or periods in a row.
        Protected tags start with a plus sign.
        Private tags start with an underscore.`)
      field.reportValidity();
      return;
    }
    if (field.value) {
      this.store.submit.tagRefs(field.value.toLowerCase().trim().split(/\s+/));
      field.value = '';
    }
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
    if (this.store.submit.exts.length) {
      return this.router.navigate(['/tag', this.store.submit.exts[0].tag]);
    }
    if (this.store.submit.refs.length === 1) {
      return this.router.navigate(['/ref', this.store.submit.refs[0].url]);
    }
    if (this.store.submit.refs.length) {
      return this.router.navigate(['/tag', '*'], { queryParams: { sort: 'modified,DESC' } });
    }
    return null;
  }

  protected readonly console = console;
}
