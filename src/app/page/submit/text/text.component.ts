import { Component, OnInit } from "@angular/core";
import { v4 as uuid } from "uuid";
import * as moment from "moment";
import { RefService } from "../../../service/ref.service";
import { AccountService } from "../../../service/account.service";
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { TAG_REGEX } from "../../../util/format";

@Component({
  selector: 'app-submit-text',
  templateUrl: './text.component.html',
  styleUrls: ['./text.component.scss']
})
export class SubmitTextPage implements OnInit {

  submitted = false;
  textForm: FormGroup;

  constructor(
    private router: Router,
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

  addTag() {
    this.tags.push(this.fb.control('', [Validators.required, Validators.pattern(TAG_REGEX)]));
    this.submitted = false;
  }

  removeTag(index: number) {
    this.tags.removeAt(index);
  }

  submit() {
    this.submitted = true;
    this.textForm.markAllAsTouched();
    if (!this.textForm.valid) return;
    const url = 'comment://' + uuid();
    this.refs.create({
      ...this.textForm.value,
      url,
      published: moment(),
    }).subscribe(() => {
      this.router.navigate(['/ref/comments', url]);
    });
  }
}
