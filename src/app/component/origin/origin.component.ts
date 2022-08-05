import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import * as _ from 'lodash-es';
import { catchError, switchMap, throwError } from 'rxjs';
import { originForm, OriginFormComponent } from '../../form/origin/origin.component';
import { Origin } from '../../model/origin';
import { AccountService } from '../../service/account.service';
import { OriginService } from '../../service/api/origin.service';
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
    public account: AccountService,
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
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
      switchMap(() => this.origins.get(this.origin.origin)),
    ).subscribe(origin => {
      this.editing = false;
      this.origin = origin;
    });
  }

  delete() {
    this.origins.delete(this.origin.origin).subscribe(() => {
      this.deleted = true;
    });
  }
}
