import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, mergeMap, throwError } from 'rxjs';
import { Ext } from '../../../model/ext';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { QUALIFIED_TAG_REGEX, USER_REGEX } from '../../../util/format';
import { printError } from '../../../util/http';
import { localTag } from '../../../util/tag';

@Component({
  selector: 'app-edit-tag-page',
  templateUrl: './edit.component.html',
  styleUrls: ['./edit.component.scss'],
})
export class EditTagPage implements OnInit {

  ext!: Ext;
  submitted = false;
  editForm!: FormGroup;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    private location: Location,
    private router: Router,
    private route: ActivatedRoute,
    private account: AccountService,
    private exts: ExtService,
    private fb: FormBuilder,
  ) {
    this.ext$.subscribe(ext => {
      this.ext = ext;
      let configControls = {};
      if (this.root) {
        configControls = {
          ...configControls,
          sidebar: [''],
          pinned: fb.array([]),
        };
      }
      if (this.user) {
        configControls = {
          ...configControls,
          subscriptions: fb.array([]),
        };
      }
      if (this.queue) {
        configControls = {
          ...configControls,
          bounty: [''],
          maxAge: [''],
          approvers: fb.array([]),
        };
      }
      this.editForm = fb.group({
        tag: [''],
        name: [''],
        config: fb.group(configControls),
      });
      if (this.root) {
        while (this.pinned.length < (ext.config?.pinned?.length || 0)) this.addPinned();
      }
      if (this.user) {
        while (this.subscriptions.length < (ext.config?.subscriptions?.length || 0)) this.addSub();
      }
      if (this.queue) {
        while (this.approvers.length < (ext.config?.approvers?.length || 0)) this.addApprover();
      }
      this.editForm.patchValue(ext);
    });
  }

  ngOnInit(): void {
  }

  get root() {
    return !!this.admin.status.templates.root;
  }

  get user() {
    return !!this.admin.status.templates.user && (
      this.ext.tag.startsWith('user/') ||
      this.ext.tag.startsWith('_user/'));
  }

  get queue() {
    return !!this.admin.status.templates.queue && (
      this.ext.tag.startsWith('queue/') ||
      this.ext.tag.startsWith('_queue/'));
  }

  get tag$() {
    return this.route.params.pipe(
      map(params => localTag(params['tag'])),
    );
  }

  get ext$() {
    return this.tag$.pipe(
      mergeMap(tag => this.exts.get(tag)),
    );
  }

  get tag() {
    return this.editForm.get('tag') as FormControl;
  }

  get name() {
    return this.editForm.get('name') as FormControl;
  }

  get config() {
    return this.editForm.get('config') as FormGroup;
  }

  get sidebar() {
    return this.config.get('sidebar') as FormControl;
  }

  get pinned() {
    return this.config.get('pinned') as FormArray;
  }

  get subscriptions() {
    return this.config.get('subscriptions') as FormArray;
  }

  get bounty() {
    return this.config.get('bounty') as FormControl;
  }

  get maxAge() {
    return this.config.get('maxAge') as FormControl;
  }

  get approvers() {
    return this.config.get('approvers') as FormArray;
  }

  addPinned() {
    this.pinned.push(this.fb.control('', [Validators.required]));
    this.submitted = false;
  }

  removePinned(index: number) {
    this.pinned.removeAt(index);
  }

  addSub() {
    this.subscriptions.push(this.fb.control('', [Validators.required, Validators.pattern(QUALIFIED_TAG_REGEX)]));
    this.submitted = false;
  }

  removeSub(index: number) {
    this.subscriptions.removeAt(index);
  }

  addApprover() {
    this.approvers.push(this.fb.control('', [Validators.required, Validators.pattern(USER_REGEX)]));
    this.submitted = false;
  }

  removeApprover(index: number) {
    this.approvers.removeAt(index);
  }

  save() {
    this.serverError = [];
    this.submitted = true;
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) return;
    this.exts.update({
      ...this.ext,
      ...this.editForm.value,
      config: {
        ...this.ext.config,
        ...this.editForm.value.config,
      },
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.location.back();
    });
  }
}
