import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import * as _ from 'lodash-es';
import { catchError, switchMap, throwError } from 'rxjs';
import { feedForm, FeedFormComponent } from '../../form/feed/feed.component';
import { Feed } from '../../model/feed';
import { AdminService } from '../../service/admin.service';
import { FeedService } from '../../service/api/feed.service';
import { Store } from '../../store/store';
import { interestingTags, TAG_REGEX_STRING, urlSummary } from '../../util/format';
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

  editForm: UntypedFormGroup;
  submitted = false;
  tagging = false;
  editing = false;
  deleting = false;
  @HostBinding('class.deleted')
  deleted = false;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    public store: Store,
    private feeds: FeedService,
    private fb: UntypedFormBuilder,
  ) {
    this.editForm = feedForm(fb);
  }

  @ViewChild(FeedFormComponent)
  set refForm(value: FeedFormComponent) {
    _.defer(() => value?.setFeed(this.feed));
  }

  ngOnInit(): void {
  }

  get tags() {
    return interestingTags(this.feed.tags);
  }

  get host() {
    return urlSummary(this.feed.url);
  }

  addInlineTag() {
    if (!this.inlineTag) return;
    const tag = (this.inlineTag.nativeElement.value as string).toLowerCase();
    this.feeds.patch(this.feed.url, this.feed.origin!, [{
      op: 'add',
      path: '/tags/-',
      value: tag,
    }]).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
      switchMap(() => this.feeds.get(this.feed.url, this.feed.origin!)),
    ).subscribe(ref => {
      this.tagging = false;
      this.feed = ref;
    });
  }

  save() {
    this.submitted = true;
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) return;
    this.feeds.update({
      ...this.feed,
      ...this.editForm.value,
    }).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
      switchMap(() => this.feeds.get(this.feed.url, this.feed.origin)),
    ).subscribe(ref => {
      this.editing = false;
      this.feed = ref;
    });
  }

  delete() {
    this.feeds.delete(this.feed.url, this.feed.origin!).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(() => {
      this.deleted = true;
    });
  }

  scrape() {
    this.feeds.scrape(this.feed.url, this.feed.origin!).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
      switchMap(() => this.feeds.get(this.feed.url, this.feed.origin)),
    ).subscribe(ref => {
      this.feed = ref;
    });
  }
}
