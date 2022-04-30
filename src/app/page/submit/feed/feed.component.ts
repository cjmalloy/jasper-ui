import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import * as moment from 'moment';
import { catchError, throwError } from 'rxjs';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { FeedService } from '../../../service/api/feed.service';
import { ThemeService } from '../../../service/theme.service';
import { TAG_REGEX } from '../../../util/format';
import { printError } from '../../../util/http';

@Component({
  selector: 'app-submit-feed',
  templateUrl: './feed.component.html',
  styleUrls: ['./feed.component.scss'],
})
export class SubmitFeedPage implements OnInit {

  submitted = false;
  feedForm: FormGroup;
  serverError: string[] = [];

  constructor(
    private theme: ThemeService,
    private router: Router,
    private route: ActivatedRoute,
    private admin: AdminService,
    private account: AccountService,
    private feeds: FeedService,
    private fb: FormBuilder,
  ) {
    theme.setTitle('Submit: Feed');
    this.feedForm = fb.group({
      url: [''],
      name: [''],
      tags: fb.array([]),
      scrapeInterval: ['00:15:00'],
      scrapeDescription: [true],
      removeDescriptionIndent: [false],
    });
    this.addTag('public');
    if (this.admin.status.plugins.thumbnail) this.addTag('plugin/thumbnail');
    route.queryParams.subscribe(params => {
      this.url.setValue(params['url'].trim());
      if (params['tag']) {
        this.addTag(params['tag']);
      }
    });
  }

  ngOnInit(): void {
  }

  get url() {
    return this.feedForm.get('url') as FormControl;
  }

  get title() {
    return this.feedForm.get('title') as FormControl;
  }

  get tags() {
    return this.feedForm.get('tags') as FormArray;
  }

  addTag(value = '') {
    this.tags.push(this.fb.control(value, [Validators.required, Validators.pattern(TAG_REGEX)]));
    this.submitted = false;
  }

  removeTag(index: number) {
    this.tags.removeAt(index);
  }

  get scrapeInterval() {
    return this.feedForm.get('scrapeInterval') as FormControl;
  }

  get scrapeDescription() {
    return this.feedForm.get('scrapeDescription') as FormControl;
  }

  get removeDescriptionIndent() {
    return this.feedForm.get('removeDescriptionIndent') as FormControl;
  }

  submit() {
    this.serverError = [];
    this.submitted = true;
    this.feedForm.markAllAsTouched();
    if (!this.feedForm.valid) return;
    this.feeds.create({
      ...this.feedForm.value,
      scrapeInterval: moment.duration(this.feedForm.value.scrapeInterval),
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.router.navigate(['/settings/feed']);
    });
  }
}
