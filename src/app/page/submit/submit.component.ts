import { Component, OnDestroy, OnInit } from '@angular/core';
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
import { v4 as uuid } from 'uuid';
import { Plugin } from '../../model/plugin';
import { Ref } from '../../model/ref';
import { isWiki, wikiUriFormat } from '../../mods/wiki';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { AuthzService } from '../../service/authz.service';
import { ModService } from '../../service/mod.service';
import { Store } from '../../store/store';
import { URI_REGEX } from '../../util/format';
import { fixUrl } from '../../util/http';
import { hasPrefix } from '../../util/tag';

type Validation = { test: (url: string) => Observable<any>; name: string; passed: boolean };

@Component({
  standalone: false,
  selector: 'app-submit-page',
  templateUrl: './submit.component.html',
  styleUrls: ['./submit.component.scss'],
})
export class SubmitPage implements OnInit, OnDestroy {
  private disposers: IReactionDisposer[] = [];

  submitForm: UntypedFormGroup;

  validations: Validation[] = [];


  genUrl = 'internal:' + uuid();
  plugin = '';
  private _selectedPlugin?: Plugin;
  serverErrors: string[] = [];
  existingRef?: Ref;

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
      url: ['', [Validators.required], [this.validator]],
      scrape: [true],
    });
    runInAction(() => {
      store.submit.wikiPrefix = admin.getWikiPrefix();
      store.submit.submitGenId = this.admin.submitGenId.filter(p => p.config?.submitDm || this.auth.canAddTag(p.tag));
      store.submit.submitDm = this.admin.submitDm;
    });
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      this.plugin = '';
      for (const t of this.store.submit.tags) {
        if (hasPrefix(t, 'plugin')) {
          this.plugin = t;
          break;
        }
      }
      this.validations.length = 0;
      if (!this.admin.isWikiExternal() && this.store.submit.wiki) {
        this.validations.push({ name: 'Valid title', passed: false, test: url => of(this.linkType(this.fixed(url))) });
        this.validations.push({ name: 'Not created yet', passed: true, test: url => this.exists(this.fixed(url)).pipe(map(exists => !exists)) });
      } else {
        this.url.setValue(this.store.submit.url);
        this.validations.push({ name: 'Valid link', passed: false, test: url => of(this.linkType(this.fixed(url))) });
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

  get selectedPlugin() {
    if (!this.plugin) {
      this._selectedPlugin = undefined;
    } else if (this._selectedPlugin?.tag != this.plugin) {
      this._selectedPlugin = this.admin.getPlugin(this.plugin);
    }
    return this._selectedPlugin;
  }

  get url() {
    return this.submitForm.get('url') as UntypedFormControl;
  }

  get placeholder() {
    return this.store.submit.wiki ? '' : $localize`URL...`;
  }

  get wikify() {
    return wikiUriFormat(this.url.value);
  }

  get validator(): AsyncValidatorFn {
    return (control: AbstractControl) => this.validLink(control);
  }

  get bannedUrls() {
    return this.admin.getTemplate('banlist')?.config?.bannedUrls || this.admin.def.templates.banlistConfig.config!.bannedUrls;
  }

  submitInternal(tag: string) {
    return uniq([...without(this.store.submit.tags, ...this.store.submit.submitGenId.map(p => p.tag)), tag]);
  }

  fixed(url: string) {
    if (this.store.submit.wiki) {
      return wikiUriFormat(url, this.admin.getWikiPrefix());
    }
    return fixUrl(url, this.admin.getTemplate('banlist') || this.admin.def.templates.banlistConfig);
  }

  exists(url: string) {
    if (this.linkType(url)) {
      if (this.existingRef?.url === url && this.existingRef.origin === this.store.account.origin) return of(true);
      return timer(400).pipe(
        switchMap(() => this.refs.getCurrent(url)),
        tap(ref => this.existingRef = ref),
        map(ref => ref.url === url && ref.origin === this.store.account.origin),
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

  get repost() {
    return !this.submitForm.valid && this.existingRef;
  }

  submit() {
    let tags = this.store.submit.tags;
    if (this.repost) {
      tags.push('plugin/repost')
    }
    if (this.url.value.trim().toLowerCase().startsWith('<iframe')) {
      tags.push('plugin/embed');
    }
    if (this.store.submit.web && this.plugin) {
      tags.push(this.plugin);
    }
    const url = this.fixed(this.url.value);
    this.router.navigate(['./submit', this.editor(this.linkType(url))], {
      queryParams: {
        url,
        tag: uniq(tags),
      },
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
    return forkJoin(vs).pipe(
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
      },
      queryParamsHandling: 'merge'
    });
  }
}
