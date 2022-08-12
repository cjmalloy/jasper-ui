import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import * as moment from 'moment';
import { catchError, throwError } from 'rxjs';
import { feedForm, FeedFormComponent } from '../../../form/feed/feed.component';
import { isKnownEmbed } from '../../../plugin/embed';
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
  feedForm: UntypedFormGroup;
  serverError: string[] = [];

  @ViewChild(FeedFormComponent)
  feed!: FeedFormComponent;

  constructor(
    private theme: ThemeService,
    private router: Router,
    private route: ActivatedRoute,
    private admin: AdminService,
    private feeds: FeedService,
    private fb: UntypedFormBuilder,
  ) {
    theme.setTitle('Submit: Feed');
    this.feedForm = feedForm(fb);
  }

  ngAfterViewInit(): void {
    this.feed.tags.addTag('public');
    if (this.admin.status.plugins.thumbnail) this.feed.tags.addTag('plugin/thumbnail');
    this.route.queryParams.subscribe(params => {
      this.url = params['url'].trim();
      if (params['tag']) {
        this.feed.tags.addTag(params['tag']);
      }
    });
  }

  set url(value: string) {
    if (this.admin.status.plugins.embed && isKnownEmbed(value)) this.feed.tags.addTag('plugin/embed');
    this.feed.url?.setValue(value);
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
