import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Observable } from 'rxjs';
import { HasTag } from '../../model/tag';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { PluginService } from '../../service/api/plugin.service';
import { TemplateService } from '../../service/api/template.service';

@Component({
  selector: 'app-tag',
  templateUrl: './tag.component.html',
  styleUrls: ['./tag.component.scss']
})
export class TagComponent implements OnInit {
  @HostBinding('class') css = 'list-item';
  @HostBinding('attr.tabindex') tabIndex = 0;

  @Input()
  tag!: HasTag;

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
    public admin: AdminService,
    private account: AccountService,
    private exts: ExtService,
    private plugins: PluginService,
    private templates: TemplateService,
    private fb: FormBuilder,
  ) {
    this.editForm = fb.group({
      name: [''],
    });
  }

  ngOnInit(): void {
    this.writeAccess$ = this.account.writeAccessTag(this.tag.tag);
    this.editForm.patchValue(this.tag);
  }

  get qualifiedTag() {
    return this.tag.tag + this.tag.origin;
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
