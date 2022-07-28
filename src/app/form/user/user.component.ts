import { Component, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { User } from '../../model/user';
import { USER_REGEX } from '../../util/format';
import { QtagsFormComponent } from '../qtags/qtags.component';

@Component({
  selector: 'app-user-form',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss']
})
export class UserFormComponent implements OnInit {
  @HostBinding('class') css = 'nested-form';

  @Input()
  group!: FormGroup;

  @ViewChild('readAccess')
  readAccess!: QtagsFormComponent;
  @ViewChild('writeAccess')
  writeAccess!: QtagsFormComponent;
  @ViewChild('tagReadAccess')
  tagReadAccess!: QtagsFormComponent;
  @ViewChild('tagWriteAccess')
  tagWriteAccess!: QtagsFormComponent;

  constructor() { }

  ngOnInit(): void {
  }

  get tag() {
    return this.group.get('tag') as FormControl;
  }

  setUser(user: User) {
    const readAccess = this.group.get('readAccess') as FormArray;
    const writeAccess = this.group.get('writeAccess') as FormArray;
    const tagReadAccess = this.group.get('tagReadAccess') as FormArray;
    const tagWriteAccess = this.group.get('tagWriteAccess') as FormArray;
    while (readAccess.length < (user.readAccess?.length || 0)) this.readAccess.addTag()
    while (writeAccess.length < (user.writeAccess?.length || 0)) this.writeAccess.addTag();
    while (tagReadAccess.length < (user.tagReadAccess?.length || 0)) this.tagReadAccess.addTag();
    while (tagWriteAccess.length < (user.tagWriteAccess?.length || 0)) this.tagWriteAccess.addTag();
    this.group.patchValue(user);
  }

}

export function userForm(fb: FormBuilder) {
  return fb.group({
    tag: ['', [Validators.required, Validators.pattern(USER_REGEX)]],
    name: [''],
    readAccess: fb.array([]),
    writeAccess: fb.array([]),
    tagReadAccess: fb.array([]),
    tagWriteAccess: fb.array([]),
  });
}
