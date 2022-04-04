import { Component, OnInit } from "@angular/core";
import { RefService } from "../../service/ref.service";
import { catchError, map, Observable, of } from "rxjs";
import * as _ from "lodash";

type Validation = { test: (url: string) => Observable<any>; name: string; passed: boolean };

@Component({
  selector: 'app-submit',
  templateUrl: './submit.component.html',
  styleUrls: ['./submit.component.scss']
})
export class SubmitPage implements OnInit {

  validations: Validation[] = [
    { name: 'Valid Link', passed: false, test: url => of(!!this.linkType(url)) },
    { name: 'Not submitted yet', passed: false, test: url => this.refs.exists(url).pipe(map(() => false), catchError(err => of(err.status === 404)))},
    { name: 'Link shortener', passed: false, test: url => of(!url.includes('bit.ly')) },
  ];

  constructor(
    private refs: RefService,
  ) { }

  get allPassed() {
    return _.every(this.validations, v => v.passed);
  }

  ngOnInit(): void {
  }

  checkLink(value: string) {
    for (const v of this.validations) {
      v.test(value).pipe(
        catchError(() => of(false))
      ).subscribe(result => v.passed = !!result)
    }
  }

  linkType(value: string) {
    try {
      const url = new URL(value);
      if (url.protocol === 'http:' || url.protocol === 'https:') return 'web';
    } catch (e) {}
    return null;
  }
}
