import { Component, ElementRef, HostBinding, Input, OnInit, ViewChild } from "@angular/core";
import { Ref } from "../../model/ref";
import { RefService } from "../../service/ref.service";
import { authors, interestingTags, refUrlSummary, TAG_REGEX, webLink } from "../../util/format";
import * as _ from "lodash";
import { mergeMap, Observable } from "rxjs";
import { AccountService } from "../../service/account.service";
import { FormArray, FormBuilder, FormGroup, Validators } from "@angular/forms";

@Component({
  selector: 'app-ref',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss']
})
export class RefComponent implements OnInit {
  @HostBinding('class') css = 'ref';
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
  commentCount?: number;
  responseCount?: number;
  sourceCount?: number;
  expandPlugin?: string;
  tagging = false;
  editing = false;
  writeAccess$?: Observable<boolean>;

  constructor(
    private fb: FormBuilder,
    private account: AccountService,
    private refs: RefService,
  ) {
    this.editForm = fb.group({
      comment: [''],
      sources: fb.array([]),
      tags: fb.array([]),
    });
  }

  ngOnInit(): void {
    this.writeAccess$ = this.account.writeAccess(this.ref);
    this.refs.count({ query: 'plugin/comment@*', responses: this.ref.url }).subscribe(n => this.commentCount = n);
    this.refs.count({ query: '!plugin/comment@*', responses: this.ref.url }).subscribe(n => this.responseCount = n);
    this.refs.count({ sources: this.ref.url }).subscribe(n => this.sourceCount = n);
    if (this.ref.tags) {
      this.expandPlugin = _.intersection(this.ref.tags, this.expandable)[0];
    }
    while (this.sourcesForm.length < (this.ref?.sources?.length || 0)) this.addSource();
    while (this.tagsForm.length < (this.ref?.tags?.length || 0)) this.addTag();
    this.editForm.patchValue(this.ref);
  }

  get authors() {
    return authors(this.ref);
  }

  get tags() {
    return interestingTags(this.ref.tags);
  }

  get host() {
    return refUrlSummary(this.ref);
  }

  get webLink() {
    return webLink(this.ref);
  }

  get tagsForm() {
    return this.editForm.get('tags') as FormArray;
  }

  get sourcesForm() {
    return this.editForm.get('sources') as FormArray;
  }

  get comments() {
    if (this.commentCount === undefined) return '? comments';
    if (this.commentCount === 0) return 'comment';
    if (this.commentCount === 1) return '1 comment';
    return this.commentCount + ' comments';
  }

  get responses() {
    if (this.responseCount === undefined) return '? citations';
    if (this.responseCount === 0) return 'uncited';
    if (this.responseCount === 1) return '1 citation';
    return this.responseCount + ' citations';
  }

  get sources() {
    if (this.sourceCount === undefined) return '? sources';
    if (this.sourceCount === 0) return 'unsourced';
    if (this.sourceCount === 1) return '1 source';
    return this.sourceCount + ' sources';
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
      mergeMap(() => this.refs.get(this.ref.url, this.ref.origin)),
    ).subscribe(ref => {
      this.editing = false;
      this.ref = ref;
    });
  }
}
