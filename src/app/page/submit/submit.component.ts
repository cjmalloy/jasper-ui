import { Component, HostBinding, OnDestroy, OnInit } from '@angular/core';
import {
  AbstractControl,
  AsyncValidatorFn,
  UntypedFormBuilder,
  UntypedFormControl,
  UntypedFormGroup,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import { uniq, without } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { catchError, forkJoin, map, mergeMap, Observable, of, switchMap, timer } from 'rxjs';
import { scan, tap } from 'rxjs/operators';
import { Ref } from '../../model/ref';
import { isWiki, wikiUriFormat } from '../../plugin/wiki';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { ScrapeService } from '../../service/api/scrape.service';
import { AuthzService } from '../../service/authz.service';
import { ThemeService } from '../../service/theme.service';
import { Store } from '../../store/store';
import { URI_REGEX } from '../../util/format';

type Validation = { test: (url: string) => Observable<any>; name: string; passed: boolean };

@Component({
  selector: 'app-submit-page',
  templateUrl: './submit.component.html',
  styleUrls: ['./submit.component.scss'],
})
export class SubmitPage implements OnInit, OnDestroy {
  @HostBinding('class') css = 'full-page-form';
  private disposers: IReactionDisposer[] = [];

  submitForm: UntypedFormGroup;

  validations: Validation[] = [];

  serverErrors: string[] = [];
  existingRef?: Ref;
  scrape = true;

  constructor(
    public admin: AdminService,
    private theme: ThemeService,
    private router: Router,
    public store: Store,
    private auth: AuthzService,
    private refs: RefService,
    private feeds: ScrapeService,
    private fb: UntypedFormBuilder,
  ) {
    theme.setTitle('Submit: Link');
    this.submitForm = fb.group({
      url: ['', [Validators.required], [this.validator]],
      scrape: [true],
    });
    runInAction(() => {
      store.submit.wikiPrefix = admin.getWikiPrefix();
      store.submit.plugins = admin.pluginConfigProperty('submit').filter(p => auth.tagReadAccess(p.tag));
    });
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      this.validations.length = 0;
      if (!this.admin.isWikiExternal() && this.store.submit.wiki) {
        this.scrape = false;
        this.validations.push({ name: 'Valid title', passed: false, test: url => of(this.linkType(this.fixed(url))) });
        this.validations.push({ name: 'Not created yet', passed: true, test: url => this.exists(this.fixed(url)).pipe(map(exists => !exists)) });
      } else {
        this.url.setValue(this.store.submit.url);
        if (this.store.submit.feed || this.store.submit.origin) {
          this.scrape = false;
          this.validations.push({ name: 'Valid Web link', passed: false, test: url => of('web' === this.linkType(this.fixed(url))) });
        } else {
          this.validations.push({ name: 'Valid link', passed: false, test: url => of(this.linkType(this.fixed(url))) });
        }
        this.validations.push({ name: 'Not submitted yet', passed: true, test: url => this.exists(this.fixed(url)).pipe(map(exists => !exists)) });
        this.validations.push({ name: 'No link shorteners', passed: true, test: url => of(!this.isShortener(this.fixed(url))) });
      }
      this.url.updateValueAndValidity();
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  get url() {
    return this.submitForm.get('url') as UntypedFormControl;
  }

  get wikify() {
    return wikiUriFormat(this.url.value);
  }

  get validator(): AsyncValidatorFn {
    return (control: AbstractControl) => this.validLink(control);
  }

  get bannedUrls() {
    return this.admin.status.plugins.root?.config?.bannedUrls || this.admin.def.plugins.root.config!.bannedUrls;
  }

  fixed(url: string) {
    if (this.store.submit.wiki) {
      return wikiUriFormat(url, this.admin.getWikiPrefix());
    }
    return url;
  }

  exists(url: string) {
    if (this.linkType(url)) {
      if (this.existingRef?.url === url) return of(true);
      return timer(400).pipe(
        switchMap(() => this.refs.get(url)),
        tap(ref => this.existingRef = ref),
        map(ref => !!ref),
        catchError(err => of(false)),
      );
    }
    return of(false);
  }

  isShortener(url: string) {
    url = url.toLowerCase();
    for (const frag of this.bannedUrls) {
      if (url.includes(frag)) return true;
    }
    return false;
  }

  submit() {
    const url = this.fixed(this.url.value);
    this.router.navigate(['./submit', this.editor(this.linkType(url))], {
      queryParams: { url, scrape: this.store.submit.link && this.scrape },
      queryParamsHandling: 'merge',
    });
  }

  validLink(control: AbstractControl): Observable<ValidationErrors | null> {
    const vs: Observable<ValidationErrors | null>[] = [];
    for (const v of this.validations) {
      vs.push(v.test(control.value).pipe(
        tap(result => v.passed = !!result),
        map(res => res ? null : { error: v.name }),
      ));
    }
    return forkJoin(...vs).pipe(
      mergeMap(res => of(...res)),
      scan((acc, value) => value ? { ...acc, ...value } : acc, {}),
    );
  }

  linkType(value: string) {
    if (this.store.submit.linkTypeOverride) return this.store.submit.linkTypeOverride;
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

  togglePlugin(plugin: string) {
    if (this.store.submit.tags.includes(plugin)) {
      return without(this.store.submit.tags, plugin);
    } else {
      return uniq([plugin].concat(this.store.submit.tags));
    }
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
        tag: uniq([...this.store.submit.tags, 'plugin/qr']),
      } ,
      queryParamsHandling: 'merge'
    });
  }
}
