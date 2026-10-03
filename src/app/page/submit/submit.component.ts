import { controlValue } from '../../util/form';
import { AsyncPipe } from '@angular/common';
import { computed, Component, ChangeDetectionStrategy, effect, signal, untracked, DestroyRef, inject } from '@angular/core';
import {
  AbstractControl,
  AsyncValidatorFn,
  ReactiveFormsModule,
  UntypedFormBuilder,
  UntypedFormControl,
  UntypedFormGroup,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { debounce, defer, isString, uniq, uniqBy, without } from 'lodash-es';
import { catchError, forkJoin, map, mergeMap, Observable, of, Subscription, switchMap, timer } from 'rxjs';
import { scan, tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { LoadingComponent } from '../../component/loading/loading.component';
import { RefComponent } from '../../component/ref/ref.component';
import { SelectPluginComponent } from '../../component/select-plugin/select-plugin.component';
import { TabsComponent } from '../../component/tabs/tabs.component';
import { AutofocusDirective } from '../../directive/autofocus.directive';
import { AudioUploadComponent } from '../../formly/audio-upload/audio-upload.component';
import { ImageUploadComponent } from '../../formly/image-upload/image-upload.component';
import { PdfUploadComponent } from '../../formly/pdf-upload/pdf-upload.component';
import { QrScannerComponent } from '../../formly/qr-scanner/qr-scanner.component';
import { VideoUploadComponent } from '../../formly/video-upload/video-upload.component';
import { Page } from '../../model/page';
import { Plugin } from '../../model/plugin';
import { Ref } from '../../model/ref';
import { isWiki, wikiUriFormat } from '../../mods/org/wiki';
import { TagPreviewPipe } from '../../pipe/tag-preview.pipe';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { AuthzService } from '../../service/authz.service';
import { ModService } from '../../service/mod.service';
import { Store } from '../../store/store';
import { Saving } from '../../store/submit';
import { getPageTitle, URI_REGEX } from '../../util/format';
import { fixUrl } from '../../util/http';
import { hasPrefix } from '../../util/tag';

type Validation = { test: (url: string) => Observable<any>; name: string; passed: boolean };

@Component({
  selector: 'app-submit-page',
  templateUrl: './submit.component.html',
  styleUrls: ['./submit.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RefComponent,
    TabsComponent,
    RouterLink,
    RouterOutlet,
    ReactiveFormsModule,
    SelectPluginComponent,
    AutofocusDirective,
    QrScannerComponent,
    PdfUploadComponent,
    AudioUploadComponent,
    VideoUploadComponent,
    ImageUploadComponent,
    LoadingComponent,
    AsyncPipe,
    TagPreviewPipe,
  ],
})
export class SubmitPage {
  private readonly controlState0 = controlValue(() => this.submitForm);
  protected readonly urlValue = controlValue(() => this.url);


  readonly uploading = signal<boolean>(false);
  readonly progress = signal<number | undefined>(undefined);
  readonly validations = signal<Validation[]>([]);
  readonly serverErrors = signal<string[]>([]);
  readonly existingRef = signal<Ref | undefined>(undefined);
  readonly responsesToUrl = signal<Page<Ref>>(Page.of([]));
  readonly responsesToUrlFor = signal<string | undefined>(undefined);
  readonly autocomplete = signal<{ value: string, label: string }[]>([]);

  submitForm: UntypedFormGroup;

  genUrl = 'internal:' + uuid();
  readonly plugin = signal<string>('');
  private _selectedPlugin?: Plugin;

  listId = 'list-' + uuid();
  private searching?: Subscription;

  constructor(
    public admin: AdminService,
    private mod: ModService,
    private router: Router,
    public store: Store,
    private auth: AuthzService,
    private refs: RefService,
    private fb: UntypedFormBuilder,
  ) {
    mod.setTitle($localize`Submit: Link`);
    this.submitForm = fb.group({
      url: ['', [Validators.required], [this.validator()]],
      scrape: [true],
    });
    {
      store.submit.wikiPrefix.set(admin.getWikiPrefix());
      store.submit.submitGenId.set(this.admin.submitGenId().filter(p => p.config?.submitDm || this.auth.canAddTag(p.tag)));
      store.submit.submitDm.set(this.admin.submitDm());
    };
    effect(() => {
      this.store.submit.wiki();
      this.store.submit.url();
      this.store.submit.tags();
      untracked(() => {
        const validations: Validation[] = [];
        if (!this.admin.isWikiExternal() && this.store.submit.wiki()) {
          validations.push({ name: $localize`Valid title`, passed: false, test: url => of(this.linkType(this.fixed(url))) });
          validations.push({ name: $localize`Not created yet`, passed: true, test: url => this.exists(this.fixed(url)).pipe(map(exists => !exists)) });
        } else {
          this.url.setValue(this.store.submit.url());
          validations.push({ name: $localize`Valid link`, passed: false, test: url => of(this.linkType(this.fixed(url))) });
          validations.push({ name: $localize`Not submitted yet`, passed: true, test: url => this.exists(this.fixed(url)).pipe(map(exists => !exists)) });
          validations.push({ name: $localize`No link shorteners`, passed: true, test: url => of(!this.isShortener(this.fixed(url))) });
        }
        this.validations.set(validations);
        this.url.updateValueAndValidity();
        if (this.url.value) {
          const tags = [
            ...this.store.submit.tags(),
            ...this.admin.getPluginsForUrl(this.store.submit.url()).map(p => p.tag),
          ];
          for (const t of tags) {
            if (hasPrefix(t, 'plugin')) {
              this.plugin.set(t);
              break;
            }
          }
        }
      });
    });
  }

  private readonly destroyCleanup = inject(DestroyRef).onDestroy(() => {
    this.searching?.unsubscribe();
  });

  readonly selectedPlugin = computed(() => {
    if (!this.plugin()) {
      this._selectedPlugin = undefined;
    } else if (this._selectedPlugin?.tag != this.plugin()) {
      this._selectedPlugin = this.admin.getPlugin(this.plugin());
    }
    return this._selectedPlugin;
  });

  get url() {
    return this.submitForm.get('url') as UntypedFormControl;
  }

  readonly placeholder = computed(() => {
    return this.store.submit.wiki() ? '' : $localize`URL...`;
  });

  get wikify() {
    return wikiUriFormat(this.url.value);
  }

  readonly validator = computed<AsyncValidatorFn>(() => {
    return (control: AbstractControl) => this.validLink(control);
  });

  readonly bannedUrls = computed(() => {
    return this.admin.getTemplate('config/banlist')?.config?.bannedUrls || this.admin.def.templates['config/banlist']?.config?.bannedUrls;
  });

  submitInternal(tag: string) {
    return uniq([...without(this.store.submit.tags(), ...this.store.submit.submitGenId().map(p => p.tag)), tag]);
  }

  fixed(url: string) {
    if (this.store.submit.wiki()) {
      return wikiUriFormat(url, this.admin.getWikiPrefix());
    }
    return fixUrl(url, this.admin.getTemplate('config/banlist') || this.admin.def.templates['config/banlist']);
  }

  exists(url: string) {
    if (!this.linkType(url)) return of(false);
    if (this.existingRef()?.url === url && this.existingRef()!.origin === this.store.account.origin()) return of(true);
    if (this.responsesToUrlFor() === url) return of(false);
    return timer(400).pipe(
      switchMap(() => this.refs.page({ url, size: 1, query: this.store.account.origin() || '*', obsolete: null })),
      map(page => {
        this.existingRef.set(page.content[0]);
        return !!this.existingRef();
      }),
      catchError(err => of(false)),
      switchMap(exists => this.refs.page({ responses: url, size: 10, query: exists ? 'plugin/repost' : '', obsolete: null }).pipe(
        map(page => {
          this.responsesToUrl.set(page);
          this.responsesToUrlFor.set(url);
          return false;
        }),
        catchError(err => of(false)),
      )),
    );
  }

  isShortener(url: string) {
    url = url.toLowerCase();
    for (const frag of this.bannedUrls()) {
      if (url.includes(frag)) return true;
    }
    return false;
  }

  readonly repost = computed(() => {
    this.controlState0();
    return !this.submitForm.valid && this.existingRef();
  });

  submit() {
    let tags = this.store.submit.tags();
    if (this.repost()) {
      tags.push('plugin/repost')
    }
    if (this.url.value.trim().toLowerCase().startsWith('<iframe')) {
      tags.push('plugin/embed');
    }
    if (this.store.submit.web() && this.plugin()) {
      tags.push(this.plugin());
    }
    const url = this.fixed(this.url.value);
    this.router.navigate(['./submit', this.editor(this.linkType(url))], {
      queryParams: {
        url,
        tag: uniq(tags),
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onUpload(event?: Saving | string) {
    if (!event) {
      this.uploading.set(false);
    } else if (isString(event)) {
      // TODO set error
    } else if (event.url) {
      this.uploading.set(false);
      const tags = this.store.submit.tags();
      if (this.store.submit.web() && this.plugin()) {
        tags.push(this.plugin());
      }
      this.router.navigate(['./submit', 'text'], {
        queryParams: {
          upload: event.url,
          plugin: this.plugin(),
          title: event.name,
          tag: uniq(tags),
        },
        queryParamsHandling: 'merge',
      });
    } else {
      this.uploading.set(true);
      this.progress.set(event.progress || undefined);
    }
  }

  validLink(control: AbstractControl): Observable<ValidationErrors | null> {
    const vs: Observable<ValidationErrors | null>[] = [];
    for (const v of this.validations()) {
      vs.push(v.test(control.value).pipe(
        tap(result => v.passed = !!result),
        map(res => res ? null : { error: v.name }),
      ));
    }
    return forkJoin(vs).pipe(
      mergeMap(res => of(...res)),
      scan((acc, value) => value ? { ...acc, ...value } : acc, {}),
    );
  }

  linkType(value: string) {
    if (this.store.submit.linkTypeOverride()) return this.store.submit.linkTypeOverride();
    try {
      const url = new URL(value);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return 'web';
      }
    } catch (e) {}
    if (!this.admin.isWikiExternal() && isWiki(value, this.admin.getWikiPrefix())) return 'text';
    if (value.startsWith('comment:')) return 'text';
    if (URI_REGEX.test(value)) return 'other';
    return null;
  }

  private editor(linkType: any) {
    if (!linkType) throw 'invalid link';
    if (linkType === 'other') return 'web';
    return linkType;
  }

  scanQr(data: string) {
    if (!data) return;
    this.url.setValue(data);
    this.router.navigate([], {
      queryParams: {
        url: data,
        tag: uniq([...this.store.submit.tags()]),
      },
      queryParamsHandling: 'merge'
    });
  }

  uploadFiles(event: Event, items?: DataTransferItemList) {
    if (!items) return false;
    if (!this.admin.getPlugin('plugin/file')) return false;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const d = items[i];
      if (d?.kind === 'file') {
        const file = d.getAsFile();
        if (file) files.push(file);
      }
    }
    if (!files.length) return false;
    event.preventDefault();
    this.store.submit.setEmbedFiles(files);
    this.router.navigate(['/submit/text'], { queryParams: { tag: this.store.submit.tags() } });
    return true;
  }

  getUrlPlugin() {
    defer(() => {
      if (!this.plugin() && this.url.value) {
        for (const t of this.admin.getPluginsForUrl(this.url.value).map(p => p.tag)) {
          if (hasPrefix(t, 'plugin')) {
            this.plugin.set(t);
            break;
          }
        }
      }
    });
  }

  search = debounce((value: string) => {
    if (!value) return;
    this.searching?.unsubscribe();
    this.searching = this.refs.page({
      search: value,
      size: 3,
    }).pipe(
      catchError(() => of(Page.of([])))
    ).subscribe(page => {
      this.autocomplete.set(uniqBy(page.content, ref => ref.url).map(ref => ({ value: ref.url, label: getPageTitle(ref) })));
    });
  }, 400);
}
