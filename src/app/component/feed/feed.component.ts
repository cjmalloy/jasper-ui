import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { catchError, mergeMap, throwError } from 'rxjs';
import { Feed } from '../../model/feed';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { FeedService } from '../../service/api/feed.service';
import { interestingTags, TAG_REGEX, TAG_REGEX_STRING, urlSummary } from '../../util/format';
import { printError } from '../../util/http';

@Component({
  selector: 'app-feed',
  templateUrl: './feed.component.html',
  styleUrls: ['./feed.component.scss'],
})
export class FeedComponent implements OnInit {
  @HostBinding('class') css = 'feed list-item';
  @HostBinding('attr.tabindex') tabIndex = 0;
  tagRegex = TAG_REGEX_STRING;

  @Input()
  feed!: Feed;
  @Input()
  expanded = false;
  @Input()
  showToggle = false;

  @ViewChild('inlineTag')
  inlineTag?: ElementRef;

  editForm: FormGroup;
  submitted = false;
  tagging = false;
  editing = false;
  deleting = false;
  @HostBinding('class.deleted')
  deleted = false;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    public account: AccountService,
    private feeds: FeedService,
    private fb: FormBuilder,
  ) {
    this.editForm = fb.group({
      name: [''],
      tags: fb.array([]),
      scrapeInterval: ['00:15:00'],
      scrapeDescription: [true],
      removeDescriptionIndent: [false],
    });
  }

  ngOnInit(): void {
    while (this.tagsForm.length < (this.feed?.tags?.length || 0)) this.addTag();
    this.editForm.patchValue(this.feed);
  }

  get tags() {
    return interestingTags(this.feed.tags);
  }

  get host() {
    return urlSummary(this.feed.url);
  }

  get tagsForm() {
    return this.editForm.get('tags') as FormArray;
  }

  addInlineTag() {
    if (!this.inlineTag) return;
    const tag = this.inlineTag.nativeElement.value;
    this.feeds.patch(this.feed.url, this.feed.origin!, [{
      op: 'add',
      path: '/tags/-',
      value: tag,
    }]).pipe(
      mergeMap(() => this.feeds.get(this.feed.url, this.feed.origin!)),
    ).subscribe(ref => {
      this.tagging = false;
      this.feed = ref;
    });
  }

  addTag(value = '') {
    this.tagsForm.push(this.fb.control(value, [Validators.required, Validators.pattern(TAG_REGEX)]));
    this.submitted = false;
  }

  removeTag(index: number) {
    this.tagsForm.removeAt(index);
  }

  get scrapeInterval() {
    return this.editForm.get('scrapeInterval') as FormControl;
  }

  get scrapeDescription() {
    return this.editForm.get('scrapeDescription') as FormControl;
  }

  get removeDescriptionIndent() {
    return this.editForm.get('removeDescriptionIndent') as FormControl;
  }

  save() {
    this.submitted = true;
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) return;
    this.feeds.update({
      ...this.feed,
      ...this.editForm.value,
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
      mergeMap(() => this.feeds.get(this.feed.url, this.feed.origin)),
    ).subscribe(ref => {
      this.editing = false;
      this.feed = ref;
    });
  }

  delete() {
    this.feeds.delete(this.feed.url, this.feed.origin!).subscribe(() => {
      this.deleted = true;
    });
  }

  scrape() {
    this.feeds.scrape(this.feed.url, this.feed.origin!).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
      mergeMap(() => this.feeds.get(this.feed.url, this.feed.origin)),
    ).subscribe(ref => {
      this.feed = ref;
    });
  }
}
