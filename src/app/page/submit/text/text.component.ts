import { Component, OnInit } from "@angular/core";
import { v4 as uuid } from "uuid";
import * as moment from "moment";
import { RefService } from "../../../service/api/ref.service";
import { AccountService } from "../../../service/account.service";
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { TAG_REGEX } from "../../../util/format";
import { catchError, throwError } from "rxjs";
import { HttpErrorResponse } from "@angular/common/http";
import { printError } from "../../../util/http";

@Component({
  selector: 'app-submit-text',
  templateUrl: './text.component.html',
  styleUrls: ['./text.component.scss']
})
export class SubmitTextPage implements OnInit {

  submitted = false;
  textForm: FormGroup;
  serverError: string[] = [];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private account: AccountService,
    private refs: RefService,
    private fb: FormBuilder,
  ) {
    this.textForm = fb.group({
      title: ['', [Validators.required]],
      comment: [''],
      tags: fb.array([
        this.fb.control('public', [Validators.required, Validators.pattern(TAG_REGEX)]),
        this.fb.control(account.tag, [Validators.required, Validators.pattern(TAG_REGEX)]),
      ]),
    });
    route.queryParams.subscribe(params => {
      if (params['tag']) {
        this.addTag(params['tag']);
      }
    });
  }

  ngOnInit(): void {
  }

  get title() {
    return this.textForm.get('title') as FormControl;
  }

  get comment() {
    return this.textForm.get('comment') as FormControl;
  }

  get tags() {
    return this.textForm.get('tags') as FormArray;
  }

  addTag(value = '') {
    this.tags.push(this.fb.control(value, [Validators.required, Validators.pattern(TAG_REGEX)]));
    this.submitted = false;
  }

  removeTag(index: number) {
    this.tags.removeAt(index);
  }

  submit() {
    this.serverError = [];
    this.submitted = true;
    this.textForm.markAllAsTouched();
    if (!this.textForm.valid) return;
    const url = 'comment://' + uuid();
    this.refs.create({
      ...this.textForm.value,
      url,
      published: moment(),
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(res);
      }),
    ).subscribe(() => {
      this.router.navigate(['/ref/comments', url]);
    });
  }
}
