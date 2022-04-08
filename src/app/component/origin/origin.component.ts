import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Observable } from 'rxjs';
import { Origin } from '../../model/origin';
import { OriginService } from '../../service/api/origin.service';

@Component({
  selector: 'app-origin',
  templateUrl: './origin.component.html',
  styleUrls: ['./origin.component.scss']
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
  writeAccess$?: Observable<boolean>;
  serverError: string[] = [];

  constructor(
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
    // this.refs.update({
    //   ...this.ref,
    //   ...this.editForm.value,
    // }).pipe(
    //   catchError((res: HttpErrorResponse) => {
    //     this.serverError = printError(res);
    //     return throwError(res);
    //   }),
    //   mergeMap(() => this.refs.get(this.ref.url, this.ref.origin)),
    // ).subscribe(ref => {
    //   this.editing = false;
    //   this.ref = ref;
    // });
  }

  delete() {
    // this.refs.delete(this.ref.url, this.ref.origin!).subscribe(() => {
    //   this.deleted = true;
    // });
  }
}
