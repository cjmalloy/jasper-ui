import { Component, OnInit } from "@angular/core";
import { RefService } from "../../service/ref.service";
import { catchError, forkJoin, map, mergeMap, Observable, of } from "rxjs";
import { AbstractControl, AsyncValidatorFn, FormBuilder, FormGroup, ValidationErrors, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { scan, tap } from "rxjs/operators";

type Validation = { test: (url: string) => Observable<any>; name: string; passed: boolean };

@Component({
  selector: 'app-submit-page',
  templateUrl: './submit.component.html',
  styleUrls: ['./submit.component.scss']
})
export class SubmitPage implements OnInit {

  submitForm: FormGroup;

  validations: Validation[] = [
    { name: 'Valid link', passed: false, test: url => of(this.linkType(url)) },
    { name: 'Not submitted yet', passed: false, test: url => this.refs.exists(url).pipe(map(() => false), catchError(err => of(err.status === 404)))},
    { name: 'No link shorteners', passed: false, test: url => of(!url.includes('bit.ly')) },
  ];

  constructor(
    private router: Router,
    private refs: RefService,
    private fb: FormBuilder,
  ) {
    this.submitForm = fb.group({
      url: ['', [Validators.required], [this.validator]]
    });
  }

  get validator(): AsyncValidatorFn {
    return (control: AbstractControl) => this.validLink(control);
  }

  ngOnInit(): void {
  }

  submit() {
    const url = this.submitForm.value.url;
    this.router.navigate(['./submit', this.linkType(url)], { queryParams: { url } })
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
      scan((acc, value) => value ? {...acc, ...value} : acc, {}),
    );
  }

  linkType(value: string) {
    try {
      const url = new URL(value);
      if (url.protocol === 'http:' || url.protocol === 'https:') return 'web';
    } catch (e) {}
    return null;
  }
}
