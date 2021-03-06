import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import * as moment from 'moment';
import { catchError, throwError } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { getInbox } from '../../../plugin/inbox';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { ThemeService } from '../../../service/theme.service';
import { printError } from '../../../util/http';

@Component({
  selector: 'app-submit-dm',
  templateUrl: './dm.component.html',
  styleUrls: ['./dm.component.scss']
})
export class SubmitDmPage implements OnInit {

  submitted = false;
  dmForm: FormGroup;
  serverError: string[] = [];

  to = '';
  emoji = !!this.admin.status.plugins.emoji;
  latex = !!this.admin.status.plugins.latex;

  constructor(
    private theme: ThemeService,
    public admin: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private account: AccountService,
    private refs: RefService,
    private fb: FormBuilder,
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
      this.title.setValue(`DM from ${account.tag}`)
    });
  }

  ngOnInit(): void {
  }

  get title() {
    return this.dmForm.get('title') as FormControl;
  }

  get comment() {
    return this.dmForm.get('comment') as FormControl;
  }

  get tags() {
    const result = [
      'locked',
      this.account.tag,
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
    if (this.to === this.account.tag) {
      this.serverError = ['You cannot sent messages to yourself.'];
      return;
    }
    if (!this.dmForm.valid) return;
    const url = 'comment:' + uuid();
    this.refs.create({
      ...this.dmForm.value,
      url,
      published: moment(),
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
