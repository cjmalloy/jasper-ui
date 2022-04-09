import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { catchError, mergeMap, throwError } from 'rxjs';
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
  @HostBinding('class') css = 'list-item';
  @HostBinding('attr.tabindex') tabIndex = 0;

  @Input()
  origin!: Origin;

  editForm: FormGroup;
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
    private fb: FormBuilder,
  ) {
    this.editForm = fb.group({
      name: [''],
    });
  }

  ngOnInit(): void {
    this.editForm.patchValue(this.origin);
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
      mergeMap(() => this.origins.get(this.origin.origin)),
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
