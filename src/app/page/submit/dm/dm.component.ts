import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { uniq } from 'lodash-es';
import * as moment from 'moment';
import { catchError, throwError } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { getMailbox } from '../../../plugin/mailbox';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { EditorService } from '../../../service/editor.service';
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
  @HostBinding('class') css = 'full-page-form';

  submitted = false;
  dmForm: UntypedFormGroup;
  plugins: string[] = [];
  serverError: string[] = [];

  to = '';

  constructor(
    private theme: ThemeService,
    public admin: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private store: Store,
    private refs: RefService,
    private editor: EditorService,
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
      if (!this.to || hasPrefix(this.to, 'user')) {
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
    return uniq([
      'locked',
      this.store.account.localTag,
      getMailbox(this.to!),
      ...this.plugins,
    ]);
  }

  syncEditor() {
    this.editor.syncEditor(this.fb, this.dmForm);
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
    const published = this.dmForm.value.published ? moment(this.dmForm.value.published, moment.HTML5_FMT.DATETIME_LOCAL_SECONDS) : moment();
    this.refs.create({
      ...this.dmForm.value,
      url,
      origin: this.store.account.origin,
      published,
      tags: this.tags,
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.router.navigate(['/ref', url], { queryParams: { published }});
    });
  }
}
