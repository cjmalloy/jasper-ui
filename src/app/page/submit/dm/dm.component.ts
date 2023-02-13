import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
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
import { NOTIFY_REGEX } from '../../../util/format';
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

  defaultTo?: string;
  defaultNotes = $localize`Notes: ${moment().format('dddd, MMMM Do YYYY, h:mm:ss a')}`

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
    theme.setTitle($localize`Submit: Direct Message`);
    this.dmForm = fb.group({
      to: ['', [Validators.pattern(NOTIFY_REGEX)]],
      title: [''],
      comment: [''],
    });
    route.queryParams.subscribe(params => {
      if (params['to']) {
        this.to.setValue(params['to']);
      }
      if (!this.to.value || hasPrefix(this.to.value, 'user')) {
        this.defaultTo = $localize`DM from ${store.account.tag}`;
      } else {
        this.defaultTo = $localize`Message to Moderators of ${this.to.value}`;
      }
    });
  }

  ngOnInit(): void {
  }

  get to() {
    return this.dmForm.get('to') as UntypedFormControl;
  }

  get title() {
    return this.dmForm.get('title') as UntypedFormControl;
  }

  get comment() {
    return this.dmForm.get('comment') as UntypedFormControl;
  }

  get notes() {
    return !this.to.value || this.to.value === this.store.account.tag;
  }

  get tags() {
    return uniq([
      this.store.account.localTag,
        ...(this.notes ?
            ['notes'] :
            ['locked', ...this.to.value.split(/\s+/).map((t: string) => getMailbox(t))]
        ),
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
    if (!this.dmForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const url = 'comment:' + uuid();
    const published = this.dmForm.value.published ? moment(this.dmForm.value.published, moment.HTML5_FMT.DATETIME_LOCAL_SECONDS) : moment();
    this.refs.create({
      url,
      origin: this.store.account.origin,
      title: this.dmForm.value.title,
      comment: this.dmForm.value.comment,
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

  setDefaultTitle() {
    if (this.title.value && ![this.defaultTo, this.defaultNotes].includes(this.title.value)) return;
    this.title.setValue(this.notes ? this.defaultNotes : this.defaultTo);
  }
}
