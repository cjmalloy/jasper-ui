import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import * as _ from 'lodash-es';
import * as moment from 'moment/moment';
import { catchError, switchMap, throwError } from 'rxjs';
import { originForm } from '../../form/plugin/origin/origin.component';
import { RefFormComponent } from '../../form/ref/ref.component';
import { Ref } from '../../model/ref';
import { RefService } from '../../service/api/ref.service';
import { Store } from '../../store/store';
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
    public store: Store,
    private refs: RefService,
    private fb: UntypedFormBuilder,
  ) {
    this.editForm = originForm(fb);
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

  save() {
    this.submitted = true;
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) return;
    this.refs.update({
      ...this.remote,
      ...this.editForm.value,
    }).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
      switchMap(() => this.refs.get(this.remote.origin!)),
    ).subscribe(origin => {
      this.serverError = [];
      this.editing = false;
      this.remote = origin;
    });
  }

  delete() {
    this.refs.delete(this.remote.origin!).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(() => {
      this.serverError = [];
      this.deleted = true;
    });
  }
}
