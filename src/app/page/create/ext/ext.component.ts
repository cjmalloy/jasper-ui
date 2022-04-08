import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AccountService } from '../../../service/account.service';
import { ExtService } from '../../../service/api/ext.service';
import { TAG_REGEX } from '../../../util/format';
import { printError } from '../../../util/http';

@Component({
  selector: 'app-create-ext-page',
  templateUrl: './ext.component.html',
  styleUrls: ['./ext.component.scss'],
})
export class CreateExtPage implements OnInit {

  submitted = false;
  extForm: FormGroup;
  serverError: string[] = [];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private account: AccountService,
    private exts: ExtService,
    private fb: FormBuilder,
  ) {
    this.extForm = fb.group({
      tag: ['', [Validators.required, Validators.pattern(TAG_REGEX)]],
      name: [''],
      config: fb.group({
        sidebar: [''],
        pinned: fb.array([]),
      }),
    });
    route.queryParams.subscribe(params => {
      if (params['tag']) {
        this.tag.setValue(params['tag']);
      }
    });
  }

  ngOnInit(): void {
  }

  get tag() {
    return this.extForm.get('tag') as FormControl;
  }

  get name() {
    return this.extForm.get('name') as FormControl;
  }

  get config() {
    return this.extForm.get('config') as FormGroup;
  }

  get sidebar() {
    return this.config.get('sidebar') as FormControl;
  }

  get pinned() {
    return this.config.get('pinned') as FormArray;
  }

  addPinned() {
    this.pinned.push(this.fb.control('', [Validators.required]));
    this.submitted = false;
  }

  removePinned(index: number) {
    this.pinned.removeAt(index);
  }

  create() {
    this.serverError = [];
    this.submitted = true;
    this.extForm.markAllAsTouched();
    if (!this.extForm.valid) return;
    this.exts.create(this.extForm.value).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(res);
      }),
    ).subscribe(() => {
      this.router.navigate(['/tag', this.extForm.value.tag]);
    });
  }
}
