import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { originForm } from '../../../form/origin/origin.component';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { OriginService } from '../../../service/api/origin.service';
import { ThemeService } from '../../../service/theme.service';
import { printError } from '../../../util/http';

@Component({
  selector: 'app-create-origin',
  templateUrl: './origin.component.html',
  styleUrls: ['./origin.component.scss']
})
export class CreateOriginPage implements OnInit {

  submitted = false;
  originForm: UntypedFormGroup;
  serverError: string[] = [];

  constructor(
    private theme: ThemeService,
    private admin: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private account: AccountService,
    private origins: OriginService,
    private fb: UntypedFormBuilder,
  ) {
    theme.setTitle('Replicate Remote Origin');
    this.originForm = originForm(fb);
  }

  ngOnInit(): void {
  }

  create() {
    this.serverError = [];
    this.submitted = true;
    this.originForm.markAllAsTouched();
    if (!this.originForm.valid) return;
    this.origins.create(this.originForm.value).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.router.navigate(['/admin/origin']);
    });
  }
}
