import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { mapValues } from 'lodash-es';
import * as moment from 'moment';
import { catchError, forkJoin, retry, switchMap, throwError } from 'rxjs';
import { OriginService } from '../../../service/api/origin.service';
import { ThemeService } from '../../../service/theme.service';
import { scrollToFirstInvalid } from '../../../util/form';
import { ORIGIN_NOT_BLANK_REGEX, ORIGIN_REGEX } from '../../../util/format';
import { printError } from '../../../util/http';

@Component({
  selector: 'app-origins',
  templateUrl: './origins.component.html',
  styleUrls: ['./origins.component.scss']
})
export class SettingsOriginsPage {
  originPattern = ORIGIN_NOT_BLANK_REGEX.source;

  submitted = false;
  originForm: UntypedFormGroup;
  serverError: string[] = [];

  constructor(
    private theme: ThemeService,
    private origins: OriginService,
    private fb: UntypedFormBuilder,
  ) {
    theme.setTitle($localize`Settings: Origins`);
    this.originForm = fb.group({
      origin: ['', [Validators.pattern(ORIGIN_NOT_BLANK_REGEX)]],
      olderThan: [moment().format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS)],
    });
  }

  delete() {
    this.serverError = [];
    this.submitted = true;
    this.originForm.markAllAsTouched();
    if (!this.originForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const origin = this.originForm.value.origin;
    const olderThan = moment(this.originForm.value.olderThan, moment.HTML5_FMT.DATETIME_LOCAL_SECONDS);
    this.origins.delete(origin, olderThan).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.submitted = true;
    });
  }
}
