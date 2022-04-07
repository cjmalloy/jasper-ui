import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { AccountService } from "../../../service/account.service";
import { ExtService } from "../../../service/ext.service";
import { catchError, map, mergeMap, throwError } from "rxjs";
import { HttpErrorResponse } from "@angular/common/http";
import { printError } from "../../../util/http";
import { localTag } from "../../../util/tag";
import { Ext } from "../../../model/ext";

@Component({
  selector: 'app-edit-tag-page',
  templateUrl: './edit.component.html',
  styleUrls: ['./edit.component.scss']
})
export class EditTagPage implements OnInit {

  ext!: Ext;
  submitted = false;
  editForm: FormGroup;
  serverError: string[] = [];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private account: AccountService,
    private exts: ExtService,
    private fb: FormBuilder,
  ) {
    this.editForm = fb.group({
      tag: [''],
      name: [''],
      config: fb.group({
        sidebar: [''],
        pinned: fb.array([]),
      }),
    });
    this.ext$.subscribe(ext => {
      this.ext = ext;
      while (this.pinned.length < (ext.config.pinned?.length || 0)) this.addPinned();
      this.editForm.patchValue(ext);
    });
  }

  ngOnInit(): void {
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
    return this.config.get('pinned') as any;
  }

  addPinned() {
    this.pinned.push(this.fb.control('', [Validators.required]));
    this.submitted = false;
  }

  removePinned(index: number) {
    this.pinned.removeAt(index);
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
      }
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(res);
      }),
    ).subscribe(() => {
      this.router.navigate(['/tag', this.ext.tag]);
    });
  }
}
