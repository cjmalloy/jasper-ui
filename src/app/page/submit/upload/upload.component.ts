import { AsyncPipe } from '@angular/common';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { Component, effect, signal, untracked, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { uniq, without } from 'lodash-es';
import { DateTime } from 'luxon';
import { catchError, concat, last, lastValueFrom, map, of, switchMap, tap, throwError } from 'rxjs';
import { v4 as uuid } from 'uuid';
import * as XLSX from 'xlsx';
import { ExtComponent } from '../../../component/ext/ext.component';
import { LoadingComponent } from '../../../component/loading/loading.component';
import { RefComponent } from '../../../component/ref/ref.component';
import { AutofocusDirective } from '../../../directive/autofocus.directive';
import { Ext, mapExt } from '../../../model/ext';
import { mapRef, Ref } from '../../../model/ref';
import { TagPreviewPipe } from '../../../pipe/tag-preview.pipe';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { ProxyService } from '../../../service/api/proxy.service';
import { RefService } from '../../../service/api/ref.service';
import { AuthzService } from '../../../service/authz.service';
import { BookmarkService } from '../../../service/bookmark.service';
import { ModService } from '../../../service/mod.service';
import { UploadCacheService } from '../../../service/upload-cache.service';
import { Store } from '../../../store/store';
import { downloadSet } from '../../../util/download';
import { TAGS_REGEX } from '../../../util/format';
import { printError } from '../../../util/http';
import { hasTag } from '../../../util/tag';
import { FilteredModels, filterModels, getModels, getTextFile, unzip, zippedCacheFiles, zippedFile } from '../../../util/zip';

@Component({
  selector: 'app-upload',
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.scss'],
  host: { 'class': 'full-page-upload' },
  imports: [
    ExtComponent,
    RefComponent,
    RouterLink,
    ReactiveFormsModule,
    AutofocusDirective,
    LoadingComponent,
    AsyncPipe,
    TagPreviewPipe,
  ]
})
export class UploadPage {
  store = inject(Store);
  bookmarks = inject(BookmarkService);
  private mod = inject(ModService);
  private admin = inject(AdminService);
  private refs = inject(RefService);
  private exts = inject(ExtService);
  private proxy = inject(ProxyService);
  private uploadCache = inject(UploadCacheService);
  private auth = inject(AuthzService);
  private router = inject(Router);


  readonly erroredExts = signal<Ext[]>([]);
  readonly erroredRefs = signal<Ref[]>([]);
  private uploadedUrls: string[] = [];
  readonly serverErrors = signal<string[]>([]);
  readonly processing = signal<boolean>(false);
  tagRegex = TAGS_REGEX.source;
  fileCache = this.admin.getPlugin('plugin/file');

  constructor() {
    const mod = this.mod;

    mod.setTitle($localize`Submit: Upload`);
    effect(() => {
      this.store.submit.files();
      untracked(() => {
        this.readUploads(this.store.submit.files());
        this.store.submit.clearFiles();
      });
    });
    this.store.submit.clearOverride();
  }

  readUploads(uploads?: File[], forceCache = false) {
    // TODO: process sequentially and show indicator
    if (!uploads?.length) return;
    // Refs and Exts
    const files: File[] = [];
    const tables: File[] = [];
    // File Cache
    let cacheWarning = false;
    const audio: File[] = [];
    const video: File[] = [];
    const images: File[] = [];
    const pdfs: File[] = [];
    const bookmarks: File[] = [];
    const sitemap: File[] = [];
    const texts: File[] = [];
    const cache: File[] = [];
    for (let i = 0; i < uploads.length; i++) {
      const file = uploads[i];
      if (!forceCache && (file.type === 'application/json' || file.type === 'application/zip')) {
        files.push(file);
      } else if (!forceCache && file.type.startsWith('text/plain')) {
        texts.push(file);
      }  else if (!forceCache && [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.oasis.opendocument.spreadsheet',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ].includes(file.type)) {
        tables.push(file);
      } else if (!forceCache && file.type.startsWith('text/html')) {
        bookmarks.push(file);
      } else if (!forceCache && file.type.startsWith('text/xml') || file.type.startsWith('application/xml')) {
        sitemap.push(file);
      } else {
        if (!this.fileCache) cacheWarning = true;
        if (file.type.startsWith('audio/')) {
          audio.push(file);
        } else if (file.type.startsWith('video/')) {
          video.push(file);
        } else if (file.type.startsWith('image/')) {
          images.push(file);
        } else if (file.type.startsWith('application/pdf')) {
          pdfs.push(file);
        } else {
          cache.push(file);
        }
      }
    }
    // Refs and Exts
    this.read(files);
    this.readData(texts, this.store.account.localTag(), ...this.store.submit.tags());
    this.readSheet(tables, 'plugin/table', this.store.account.localTag(), ...this.store.submit.tags());
    this.readBookmarks(bookmarks, this.store.account.localTag(), ...this.store.submit.tags());
    this.readSitemap(sitemap, this.store.account.localTag(), ...this.store.submit.tags());

    if (cacheWarning) alert('File Cache has not been enabled by the admin (plugin/file) so file uploads will likely fail.')
    this.readCache(audio, 'plugin/audio', this.store.account.localTag(), ...this.store.submit.tags());
    this.readCache(video, 'plugin/video', 'plugin/thumbnail', this.store.account.localTag(), ...this.store.submit.tags());
    this.readCache(images, 'plugin/image', 'plugin/thumbnail', this.store.account.localTag(), ...this.store.submit.tags());
    this.readCache(pdfs, 'plugin/pdf', this.store.account.localTag(), ...this.store.submit.tags());
    this.readCache(cache, 'plugin/file', this.store.account.localTag(), ...this.store.submit.tags());
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
        .catch(e => alert(e));
    }
  }

  readCache(files: File[], tag: string, ...extraTags: string[]) {
    if (!files) return;
    for (let i = 0; i < files?.length; i++) {
      const file = files[i];
      this.store.submit.setCaching(file, { name: file.name, progress: 0 });
      this.proxy.save(file, this.store.account.origin()).pipe(
        map(event => {
          switch (event.type) {
            case HttpEventType.Response:
              return event.body;
            case HttpEventType.UploadProgress:
              const percentDone = event.total ? Math.round(100 * event.loaded / event.total) : 0;
              this.store.submit.setCaching(file, { name: file.name, progress: percentDone });
              return null;
          }
          return null;
        }),
        last(),
        // TODO: Why is initial cursor wrong???
        switchMap((ref: Ref | null) => this.refs.get(ref!.url, ref!.origin)),
        map((ref: Ref | null) => {
          ref!.title = file.name;
          ref!.tags = uniq([...ref!.tags || [], tag, ...extraTags.filter(t => !!t)]);
          return ref!;
        }),
        catchError((res: HttpErrorResponse) => {
          this.store.submit.removeCaching(file);
          this.serverErrors.update(errors => [...errors, ...printError(res)]);
          return throwError(() => res);
        }),
      ).subscribe(ref => {
        this.store.submit.removeCaching(file);
        this.store.submit.addRefs({ ...ref, upload: true, exists: true });
      });
    }
  }

  readUrlPlugin(files: File[], tag: string, ...extraTags: string[]) {
    if (!files) return;
    for (let i = 0; i < files?.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => this.store.submit.addRefs({
        upload: true,
        url: 'internal:' + uuid(),
        title: file.name,
        tags: uniq(['public', tag, ...extraTags.filter(t => !!t)]),
        plugins: { [tag]: { url: reader.result as string } },
        published: DateTime.now(),
      });
      reader.readAsDataURL(file);
    }
  }

  readData(files: File[], ...extraTags: string[]) {
    if (!files) return;
    for (let i = 0; i < files?.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => this.store.submit.addRefs({
        upload: true,
        url: 'internal:' + uuid(),
        title: file.name,
        tags: uniq(['public', ...extraTags.filter(t => !!t)]),
        comment: reader.result as string,
        published: DateTime.now(),
      });
      reader.readAsText(file);
    }
  }

  readBookmarks(files: File[], ...extraTags: string[]) {
    if (!files) return;
    for (let i = 0; i < files?.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => {
        const html = reader.result as string;
        const links = new DOMParser().parseFromString(html, 'text/html').documentElement.getElementsByTagName('a');
        for (let i = 0; i < links.length; i++) {
          const a = links.item(i)!;
          this.store.submit.addRefs({
            upload: true,
            url: a.href,
            title: a.innerText,
            tags: ['public', ...extraTags.filter(t => !!t)],
            published: DateTime.now(),
          });
        }
      };
      reader.readAsText(file);
    }
  }

  readSitemap(files: File[], ...extraTags: string[]) {
    if (!files) return;
    for (let i = 0; i < files?.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => {
        const xml = reader.result as string;
        const locs = new DOMParser().parseFromString(xml, 'application/xml').documentElement.getElementsByTagName('loc');
        for (let i = 0; i < locs.length; i++) {
          const loc = locs.item(i)?.textContent;
          if (!loc) continue;
          this.store.submit.addRefs({
            upload: true,
            url: loc,
            tags: ['public', ...extraTags.filter(t => !!t)],
            published: DateTime.now(),
          });
        }
      };
      reader.readAsText(file);
    }
  }

  readSheet(files: File[], ...extraTags: string[]) {
    if (!files) return;
    for (let i = 0; i < files?.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => {
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
            published: DateTime.now(),
          });
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }

  clear(upload: HTMLInputElement) {
    upload.value = '';
    this.store.submit.clearUpload();
  }

  download() {
    if (this.store.submit.empty()) return;
    return downloadSet(this.store.submit.refs(), this.store.submit.exts(), 'uploads', this.store.submit.cacheFiles);
  }

  push() {
    if (this.processing() || this.store.submit.empty()) return;
    this.processing.set(true);
    this.uploadedUrls = [];
    const uploads = [
      ...this.store.submit.exts().map(ext => this.uploadExt$(ext)),
      ...this.store.submit.refs().map(ref => this.uploadRef$(ref)),
    ];
    return lastValueFrom(concat(...uploads))
      .then(() => {
        if (!this.erroredExts().length && !this.erroredRefs().length) {
          this.postNavigate();
        }
        this.store.submit.clearUpload(this.erroredRefs(), this.erroredExts());
        this.erroredRefs.set([]);
        this.erroredExts.set([]);
        this.processing.set(false);
      });
  }

  uploadRef$(ref: Ref) {
    ref = ref;
    ref.origin = this.store.account.origin();
    ref.published ||= DateTime.now();
    const original = ref;
    return this.uploadCache.restore$(ref, this.store.account.origin()).pipe(
      switchMap(restored => {
        ref = restored;
        ref.tags = ref.tags?.filter(t => this.auth.canAddTag(t));
        ref.plugins = Object.fromEntries(
          Object.entries(ref.plugins || {}).filter(([tag]) => hasTag(tag, ref.tags)),
        );
        return this.saveRef$(ref).pipe(
          tap(() => this.uploadedUrls.push(ref.url)),
        );
      }),
      catchError((res: HttpErrorResponse) => {
        original.outdated ||= ref.outdated;
        this.erroredRefs.update(refs => [...refs, original]);
        this.serverErrors.update(errors => [...errors, ...printError(res)]);
        return of(null);
      }),
    );
  }

  private saveRef$(ref: Ref) {
    return (ref.exists
        ? this.refs.update(ref).pipe(
          catchError((err: HttpErrorResponse) => {
            if (err.status === 404) {
              return this.refs.create(ref);
            }
            return throwError(() => err);
          }),
        )
        : this.refs.create(ref)
    ).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 409) {
          if (this.store.submit.overwrite()) {
            return this.refs.get(ref.url, this.store.account.origin()).pipe(
              switchMap(existing => {
                return this.refs.update({ ...ref, modifiedString: existing.modifiedString });
              }),
            );
          } else {
            ref.outdated = true;
          }
        }
        return throwError(() => err);
      }),
    );
  }

  uploadExt$(ext: Ext) {
    ext = ext;
    ext.origin = this.store.account.origin();
    return (ext.exists
      ? this.exts.update(ext)
      : this.exts.create(ext)).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 409) {
          if (this.store.submit.overwrite()) {
            return this.exts.get(ext.tag + this.store.account.origin()).pipe(
              switchMap(existing => {
                return this.exts.update({ ...ext, modifiedString: existing.modifiedString });
              })
            );
          } else {
            ext.outdated = true;
          }
        }
        return throwError(() => err);
      }),
      catchError((res: HttpErrorResponse) => {
        this.erroredExts.update(exts => [...exts, ext]);
        this.serverErrors.update(errors => [...errors, ...printError(res)]);
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
      this.bookmarks.setTags(field.value.startsWith('-')
        ? without(this.bookmarks.tags(), field.value.substring(1))
        : uniq([...this.bookmarks.tags(), field.value]));
      this.store.submit.tagRefs(field.value.toLowerCase().trim().split(/\s+/));
      this.store.eventBus.fire('refresh:uploads');
      field.value = '';
    }
  }

  set overwrite(value: boolean) {
    this.store.submit.overwrite.set(value);
  }

  private getModels(file: File): Promise<FilteredModels> {
    if (file.name.toLowerCase().endsWith('.zip')) {
      return unzip(file).then(zip => {
        this.store.submit.addCacheFiles(zippedCacheFiles(zip));
        return zip;
      }).then(zip => Promise.all([
        zippedFile(zip, 'ext.json')
          .then(json => getModels<Ext>(json))
          .then(exts => exts.map(mapExt)),
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
    if (this.store.submit.exts().length) {
      return this.router.navigate(['/tag', this.store.submit.exts()[0].tag]);
    }
    if (this.store.submit.refs().length === 1) {
      return this.router.navigate(['/ref', this.uploadedUrls.length === 1 ? this.uploadedUrls[0] : this.store.submit.refs()[0].url]);
    }
    if (this.store.submit.refs().length) {
      return this.router.navigate(['/tag', this.store.account.tag()], { queryParams: { filter: 'query/plugin/file' } });
    }
    return null;
  }
}
