import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import * as moment from 'moment';
import { catchError, throwError } from 'rxjs';
import { TagsFormComponent } from '../../../form/tags/tags.component';
import { isKnownEmbed } from '../../../plugin/embed';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { FeedService } from '../../../service/api/feed.service';
import { ThemeService } from '../../../service/theme.service';
import { printError } from '../../../util/http';

@Component({
  selector: 'app-submit-feed',
  templateUrl: './feed.component.html',
  styleUrls: ['./feed.component.scss'],
})
export class SubmitFeedPage implements AfterViewInit {

  submitted = false;
  feedForm: FormGroup;
  serverError: string[] = [];

  @ViewChild(TagsFormComponent)
  tags!: TagsFormComponent;

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
  }

  ngAfterViewInit(): void {
    this.tags.addTag('public');
    if (this.admin.status.plugins.thumbnail) this.tags.addTag('plugin/thumbnail');
    this.route.queryParams.subscribe(params => {
      this.url = params['url'].trim();
      if (params['tag']) {
        this.tags.addTag(params['tag']);
      }
    });
  }

  get title() {
    return this.feedForm.get('title') as FormControl;
  }

  set url(value: string) {
    if (this.admin.status.plugins.embed && isKnownEmbed(value)) this.addTag('plugin/embed');
    this.feedForm.get('url')?.setValue(value);
  }

  addTag(value = '') {
    this.tags.addTag(value);
    this.submitted = false;
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
