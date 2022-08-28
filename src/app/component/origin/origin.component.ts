import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import * as _ from 'lodash-es';
import * as moment from 'moment/moment';
import { catchError, switchMap, throwError } from 'rxjs';
import { originForm } from '../../form/plugin/origin/origin.component';
import { refForm, RefFormComponent } from '../../form/ref/ref.component';
import { Ref } from '../../model/ref';
import { deleteNotice } from '../../plugin/delete';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { ScrapeService } from '../../service/api/scrape.service';
import { Store } from '../../store/store';
import { scrollToFirstInvalid } from '../../util/form';
import { interestingTags } from '../../util/format';
import { printError } from '../../util/http';

@Component({
  selector: 'app-origin',
  templateUrl: './origin.component.html',
  styleUrls: ['./origin.component.scss'],
})
export class OriginComponent implements OnInit {
  @HostBinding('class') css = 'origin list-item';
  @HostBinding('attr.tabindex') tabIndex = 0;

  @Input()
  remote!: Ref;

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
    private scraper: ScrapeService,
    private fb: UntypedFormBuilder,
  ) {
    this.editForm = refForm(fb);
  }

  @ViewChild(RefFormComponent)
  set refForm(value: RefFormComponent) {
    _.defer(() => value?.setRef(this.remote));
  }

  ngOnInit(): void {
  }

  get lastScrape() {
    return moment(this.remote.plugins!['+plugin/origin'].lastScrape);
  }

  get tags() {
    return interestingTags(this.remote.tags);
  }

  get addTags() {
    return interestingTags(this.remote.plugins!['+plugin/origin'].addTags);
  }

  get addOrigin() {
    return this.remote.plugins!['+plugin/origin'].origin;
  }

  save() {
    this.submitted = true;
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    this.refs.update({
      ...this.remote,
      ...this.editForm.value,
    }).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
      switchMap(() => this.refs.get(this.remote.url, this.remote.origin)),
    ).subscribe(origin => {
      this.serverError = [];
      this.editing = false;
      this.remote = origin;
    });
  }

  delete() {
    (this.admin.status.plugins.delete
        ? this.refs.update(deleteNotice(this.remote))
        : this.refs.delete(this.remote.url, this.remote.origin)
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
    this.scraper.feed(this.remote.url, this.remote.origin!).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
      switchMap(() => this.refs.get(this.remote.url, this.remote.origin)),
    ).subscribe(ref => {
      this.serverError = [];
      this.remote = ref;
    });
  }
}
