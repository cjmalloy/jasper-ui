import { Component, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { User } from '../../model/user';
import { USER_REGEX } from '../../util/format';
import { SelectorsFormComponent } from '../selectors/selectors.component';

@Component({
  selector: 'app-user-form',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss']
})
export class UserFormComponent implements OnInit {
  @HostBinding('class') css = 'nested-form';

  @Input()
  group!: UntypedFormGroup;

  @ViewChild('readAccess')
  readAccess!: SelectorsFormComponent;
  @ViewChild('writeAccess')
  writeAccess!: SelectorsFormComponent;
  @ViewChild('tagReadAccess')
  tagReadAccess!: SelectorsFormComponent;
  @ViewChild('tagWriteAccess')
  tagWriteAccess!: SelectorsFormComponent;

  constructor() { }

  ngOnInit(): void {
  }

  get tag() {
    return this.group.get('tag') as UntypedFormControl;
  }

  setUser(user: User) {
    const readAccess = this.group.get('readAccess') as UntypedFormArray;
    const writeAccess = this.group.get('writeAccess') as UntypedFormArray;
    const tagReadAccess = this.group.get('tagReadAccess') as UntypedFormArray;
    const tagWriteAccess = this.group.get('tagWriteAccess') as UntypedFormArray;
    while (readAccess.length < (user.readAccess?.length || 0)) this.readAccess.addTag()
    while (writeAccess.length < (user.writeAccess?.length || 0)) this.writeAccess.addTag();
    while (tagReadAccess.length < (user.tagReadAccess?.length || 0)) this.tagReadAccess.addTag();
    while (tagWriteAccess.length < (user.tagWriteAccess?.length || 0)) this.tagWriteAccess.addTag();
    this.group.patchValue(user);
  }

}

export function userForm(fb: UntypedFormBuilder) {
  return fb.group({
    tag: ['', [Validators.required, Validators.pattern(USER_REGEX)]],
    name: [''],
    readAccess: fb.array([]),
    writeAccess: fb.array([]),
    tagReadAccess: fb.array([]),
    tagWriteAccess: fb.array([]),
  });
}
