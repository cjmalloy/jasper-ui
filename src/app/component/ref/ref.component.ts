import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import * as _ from 'lodash';
import { catchError, mergeMap, Observable, throwError } from 'rxjs';
import { Ref } from '../../model/ref';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { authors, interestingTags, TAG_REGEX, urlSummary, webLink } from '../../util/format';
import { printError } from '../../util/http';

@Component({
  selector: 'app-ref',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss'],
})
export class RefComponent implements OnInit {
  @HostBinding('class') css = 'list-item';
  @HostBinding('attr.tabindex') tabIndex = 0;

  expandable = ['plugin/image', 'plugin/video'];

  @Input()
  ref!: Ref;
  @Input()
  expanded = false;
  @Input()
  showToggle = false;

  @ViewChild('inlineTag')
  inlineTag?: ElementRef;

  editForm: FormGroup;
  submitted = false;
  expandPlugin?: string;
  tagging = false;
  editing = false;
  deleting = false;
  @HostBinding('class.deleted')
  deleted = false;
  writeAccess$?: Observable<boolean>;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    public account: AccountService,
    private refs: RefService,
    private fb: FormBuilder,
  ) {
    this.editForm = fb.group({
      comment: [''],
      sources: fb.array([]),
      tags: fb.array([]),
    });
  }

  ngOnInit(): void {
    this.writeAccess$ = this.account.writeAccess(this.ref);
    if (this.ref.tags) {
      this.expandPlugin = _.intersection(this.ref.tags, this.expandable)[0];
    }
    while (this.sourcesForm.length < (this.ref?.sources?.length || 0)) this.addSource();
    while (this.tagsForm.length < (this.ref?.tags?.length || 0)) this.addTag();
    this.editForm.patchValue(this.ref);
  }

  get emoji() {
    return this.admin.status.plugins.emoji && !!this.ref.tags?.includes('plugin/emoji');
  }

  get latex() {
    return this.admin.status.plugins.latex && !!this.ref.tags?.includes('plugin/latex');
  }

  get authors() {
    return authors(this.ref);
  }

  get tags() {
    return interestingTags(this.ref.tags);
  }

  get host() {
    return urlSummary(this.ref.url);
  }

  get webLink() {
    return webLink(this.ref);
  }

  get approved() {
    return this.ref.tags?.includes('_moderated');
  }

  get tagsForm() {
    return this.editForm.get('tags') as FormArray;
  }

  get sourcesForm() {
    return this.editForm.get('sources') as FormArray;
  }

  get comments() {
    if (!this.ref.metadata) return '? comments';
    const commentCount = this.ref.metadata.plugins['plugin/comment'].length;
    if (commentCount === 0) return 'comment';
    if (commentCount === 1) return '1 comment';
    return commentCount + ' comments';
  }

  get responses() {
    if (!this.ref.metadata) return '? citations';
    const responseCount = this.ref.metadata.responses.length;
    if (responseCount === 0) return 'uncited';
    if (responseCount === 1) return '1 citation';
    return responseCount + ' citations';
  }

  get sources() {
    const sourceCount = this.ref.sources?.length || 0;
    if (sourceCount === 0) return 'unsourced';
    if (sourceCount === 1) return '1 source';
    return sourceCount + ' sources';
  }

  addInlineTag() {
    if (!this.inlineTag) return;
    const tag = this.inlineTag.nativeElement.value;
    this.refs.patch(this.ref.url, this.ref.origin!, [{
      op: 'add',
      path: '/tags/-',
      value: tag,
    }]).pipe(
      mergeMap(() => this.refs.get(this.ref.url, this.ref.origin!)),
    ).subscribe(ref => {
      this.tagging = false;
      this.ref = ref;
    });
  }

  approve() {
    this.refs.patch(this.ref.url, this.ref.origin!, [{
      op: 'add',
      path: '/tags/-',
      value: '_moderated',
    }]).pipe(
      mergeMap(() => this.refs.get(this.ref.url, this.ref.origin!)),
    ).subscribe(ref => this.ref = ref);
  }

  addTag(value = '') {
    this.tagsForm.push(this.fb.control(value, [Validators.required, Validators.pattern(TAG_REGEX)]));
    this.submitted = false;
  }

  removeTag(index: number) {
    this.tagsForm.removeAt(index);
  }

  addSource() {
    this.sourcesForm.push(this.fb.control('', [Validators.required]));
    this.submitted = false;
  }

  removeSource(index: number) {
    this.sourcesForm.removeAt(index);
  }

  save() {
    this.submitted = true;
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) return;
    this.refs.update({
      ...this.ref,
      ...this.editForm.value,
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(res);
      }),
      mergeMap(() => this.refs.get(this.ref.url, this.ref.origin)),
    ).subscribe(ref => {
      this.editing = false;
      this.ref = ref;
    });
  }

  delete() {
    this.refs.delete(this.ref.url, this.ref.origin!).subscribe(() => {
      this.deleted = true;
    });
  }
}
