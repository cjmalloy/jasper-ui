import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import * as _ from 'lodash-es';
import * as moment from 'moment';
import { catchError, switchMap, throwError } from 'rxjs';
import { refForm, RefFormComponent } from '../../form/ref/ref.component';
import { Ref } from '../../model/ref';
import { deleteNotice } from '../../plugin/delete';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { ScrapeService } from '../../service/api/scrape.service';
import { Store } from '../../store/store';
import { scrollToFirstInvalid } from '../../util/form';
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
  feed!: Ref;
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
    private refs: RefService,
    private feeds: ScrapeService,
    private fb: UntypedFormBuilder,
  ) {
    this.editForm = refForm(fb);
  }

  @ViewChild(RefFormComponent)
  set refForm(value: RefFormComponent) {
    _.defer(() => value?.setRef(this.feed));
  }

  ngOnInit(): void {
  }

  get responses() {
    if (!this.feed.metadata) return '? scraped';
    const responseCount = this.feed.metadata.responses?.length;
    if (responseCount === 0) return 'none scraped';
    return responseCount + ' scraped';
  }

  get tags() {
    return interestingTags(this.feed.tags);
  }

  get addTags() {
    return interestingTags(this.feed.plugins!['+plugin/feed'].addTags);
  }

  get addOrigin() {
    return this.feed.plugins!['+plugin/feed'].origin;
  }

  get host() {
    return urlSummary(this.feed.url);
  }

  get lastScrape() {
    return moment(this.feed.plugins!['+plugin/feed'].lastScrape);
  }

  addInlineTag() {
    if (!this.inlineTag) return;
    const tag = (this.inlineTag.nativeElement.value as string).toLowerCase();
    this.refs.patch(this.feed.url, this.feed.origin!, [{
      op: 'add',
      path: '/tags/-',
      value: tag,
    }]).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
      switchMap(() => this.refs.get(this.feed.url, this.feed.origin!)),
    ).subscribe(ref => {
      this.serverError = [];
      this.tagging = false;
      this.feed = ref;
    });
  }

  save() {
    this.submitted = true;
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    this.refs.update({
      ...this.feed,
      ...this.editForm.value,
    }).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
      switchMap(() => this.refs.get(this.feed.url, this.feed.origin)),
    ).subscribe(ref => {
      this.serverError = [];
      this.editing = false;
      this.feed = ref;
    });
  }

  delete() {
    (this.admin.status.plugins.delete
        ? this.refs.update(deleteNotice(this.feed))
        : this.refs.delete(this.feed.url, this.feed.origin)
    ).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(() => {
      this.serverError = [];
      this.deleted = true;
    });
  }

  scrape() {
    this.feeds.scrape(this.feed.url, this.feed.origin!).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
      switchMap(() => this.refs.get(this.feed.url, this.feed.origin)),
    ).subscribe(ref => {
      this.serverError = [];
      this.feed = ref;
    });
  }
}
