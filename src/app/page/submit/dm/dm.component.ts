import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import * as moment from 'moment';
import { catchError, throwError } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { getInbox } from '../../../plugin/inbox';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { ThemeService } from '../../../service/theme.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { printError } from '../../../util/http';
import { hasPrefix } from '../../../util/tag';

@Component({
  selector: 'app-submit-dm',
  templateUrl: './dm.component.html',
  styleUrls: ['./dm.component.scss']
})
export class SubmitDmPage implements OnInit {

  submitted = false;
  dmForm: UntypedFormGroup;
  serverError: string[] = [];

  to = '';
  emoji = !!this.admin.status.plugins.emoji;
  latex = !!this.admin.status.plugins.latex;

  constructor(
    private theme: ThemeService,
    public admin: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private store: Store,
    private refs: RefService,
    private fb: UntypedFormBuilder,
  ) {
    theme.setTitle('Submit: Direct Message');
    this.dmForm = fb.group({
      title: [''],
      comment: [''],
    });
    route.queryParams.subscribe(params => {
      if (params['to']) {
        this.to = params['to'];
      }
      if (hasPrefix(this.to, 'user')) {
        this.title.setValue(`DM from ${store.account.tag}`)
      } else {
        this.title.setValue(`Message to Moderators of ${this.to}`)
      }
    });
  }

  ngOnInit(): void {
  }

  get title() {
    return this.dmForm.get('title') as UntypedFormControl;
  }

  get comment() {
    return this.dmForm.get('comment') as UntypedFormControl;
  }

  get tags() {
    const result = [
      'locked',
      this.store.account.tag,
      getInbox(this.to!),
    ];
    if (this.emoji) result.push('plugin/emoji');
    if (this.latex) result.push('plugin/latex');
    return result;
  }

  submit() {
    this.serverError = [];
    this.submitted = true;
    this.dmForm.markAllAsTouched();
    if (this.to === this.store.account.tag) {
      this.serverError = ['You cannot sent messages to yourself.'];
      return;
    }
    if (!this.dmForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const url = 'comment:' + uuid();
    this.refs.create({
      ...this.dmForm.value,
      url,
      published: moment(this.dmForm.value.published, moment.HTML5_FMT.DATETIME_LOCAL_SECONDS),
      tags: this.tags,
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.router.navigate(['/ref', url]);
    });
  }
}
