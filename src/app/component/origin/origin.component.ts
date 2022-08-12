import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import * as _ from 'lodash-es';
import { catchError, switchMap, throwError } from 'rxjs';
import { originForm, OriginFormComponent } from '../../form/origin/origin.component';
import { Origin } from '../../model/origin';
import { OriginService } from '../../service/api/origin.service';
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
  origin!: Origin;

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
    private origins: OriginService,
    private fb: UntypedFormBuilder,
  ) {
    this.editForm = originForm(fb);
  }

  @ViewChild(OriginFormComponent)
  set refForm(value: OriginFormComponent) {
    _.defer(() => value?.setOrigin(this.origin));
  }

  ngOnInit(): void {
  }

  save() {
    this.submitted = true;
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) return;
    this.origins.update({
      ...this.origin,
      ...this.editForm.value,
    }).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
      switchMap(() => this.origins.get(this.origin.origin)),
    ).subscribe(origin => {
      this.serverError = [];
      this.editing = false;
      this.origin = origin;
    });
  }

  delete() {
    this.origins.delete(this.origin.origin).pipe(
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
