import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import { AccountService } from "../../../service/account.service";
import { RefService } from "../../../service/ref.service";
import * as moment from "moment";
import { TAG_REGEX } from "../../../util/format";
import { catchError, throwError } from "rxjs";
import { HttpErrorResponse } from "@angular/common/http";
import { printError } from "../../../util/http";

@Component({
  selector: 'app-submit-web-page',
  templateUrl: './web.component.html',
  styleUrls: ['./web.component.scss']
})
export class SubmitWebPage implements OnInit {

  submitted = false;
  webForm: FormGroup;
  serverError: string[] = [];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private account: AccountService,
    private refs: RefService,
    private fb: FormBuilder,
  ) {
    this.webForm = fb.group({
      url: [''],
      published: ['', [Validators.required]],
      title: ['', [Validators.required]],
      comment: [''],
      sources: fb.array([]),
      tags: fb.array([
        this.fb.control('public', [Validators.required, Validators.pattern(TAG_REGEX)]),
        this.fb.control(account.tag, [Validators.required, Validators.pattern(TAG_REGEX)]),
      ]),
    });
    route.queryParams.subscribe(params => {
      this.url = params['url'];
      if (params['tag']) {
        this.addTag(params['tag']);
      }
    });
  }

  ngOnInit(): void {
  }

  get published() {
    return this.webForm.get('published') as FormControl;
  }

  get title() {
    return this.webForm.get('title') as FormControl;
  }

  get comment() {
    return this.webForm.get('comment') as FormControl;
  }

  get tags() {
    return this.webForm.get('tags') as FormArray;
  }

  get sources() {
    return this.webForm.get('sources') as FormArray;
  }

  set url(value: string) {
    this.webForm.get('url')?.setValue(value);
  }

  addTag(value = '') {
    this.tags.push(this.fb.control(value, [Validators.required, Validators.pattern(TAG_REGEX)]));
    this.submitted = false;
  }

  removeTag(index: number) {
    this.tags.removeAt(index);
  }

  addSource() {
    this.sources.push(this.fb.control('', [Validators.required]));
    this.submitted = false;
  }

  removeSource(index: number) {
    this.sources.removeAt(index);
  }

  submit() {
    this.serverError = [];
    this.submitted = true;
    this.webForm.markAllAsTouched();
    if (!this.webForm.valid) return;
    this.refs.create({
      ...this.webForm.value,
      published: moment(this.webForm.value.published).toISOString(),
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(res);
      }),
    ).subscribe(() => {
      this.router.navigate(['/ref/comments', this.webForm.value.url]);
    });
  }
}
