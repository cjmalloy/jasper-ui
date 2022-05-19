import { Component, OnInit } from '@angular/core';
import { AbstractControl, AsyncValidatorFn, FormBuilder, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, map, mergeMap, Observable, of } from 'rxjs';
import { scan, tap } from 'rxjs/operators';
import { FeedService } from '../../service/api/feed.service';
import { RefService } from '../../service/api/ref.service';
import { ThemeService } from '../../service/theme.service';

type Validation = { test: (url: string) => Observable<any>; name: string; passed: boolean };

@Component({
  selector: 'app-submit-page',
  templateUrl: './submit.component.html',
  styleUrls: ['./submit.component.scss'],
})
export class SubmitPage implements OnInit {

  submitForm: FormGroup;

  validations: Validation[] = [
    { name: 'Valid link', passed: false, test: url => of(this.linkType(url)) },
    { name: 'Not submitted yet', passed: false, test: url => this.exists(url).pipe(map(exists => !exists)) },
    { name: 'No link shorteners', passed: false, test: url => of(!url.includes('bit.ly')) },
  ];

  linkTypeOverride?: string;

  constructor(
    private theme: ThemeService,
    private router: Router,
    private route: ActivatedRoute,
    private refs: RefService,
    private feeds: FeedService,
    private fb: FormBuilder,
  ) {
    theme.setTitle('Submit: Link');
    this.submitForm = fb.group({
      url: ['', [Validators.required], [this.validator]],
    });
    route.queryParams.subscribe(params => {
      if (params['linkType']) {
        this.linkTypeOverride = params['linkType'];
      }
      if (params['url']) {
        this.url.setValue(params['url']);
      }
    });
  }

  ngOnInit(): void {
  }

  get url() {
    return this.submitForm.get('url') as FormControl;
  }

  get validator(): AsyncValidatorFn {
    return (control: AbstractControl) => this.validLink(control);
  }

  exists(url: string) {
    const linkType = this.linkType(url);
    if (linkType === 'web') {
      return this.refs.exists(url);
    }
    if (linkType === 'feed') {
      return this.feeds.exists(url);
    }
    return of(false);
  }

  submit() {
    const url = this.submitForm.value.url;
    this.router.navigate(['./submit', this.linkType(url)], {
      queryParams: { url },
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
    if (this.linkTypeOverride) return this.linkTypeOverride;
    try {
      const url = new URL(value);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        if (url.pathname.endsWith('.rss') || url.pathname.endsWith('.xml')) {
          return 'feed';
        }
        return 'web';
      }
    } catch (e) {}
    return null;
  }
}
