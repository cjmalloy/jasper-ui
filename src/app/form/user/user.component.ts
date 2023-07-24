import { Component, ElementRef, EventEmitter, HostBinding, Input, OnInit, Output, ViewChild } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { User } from '../../model/user';
import { isMailbox } from '../../mods/mailbox';
import { USER_REGEX } from '../../util/format';
import { TagsFormComponent } from '../tags/tags.component';

@Component({
  selector: 'app-user-form',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss']
})
export class UserFormComponent implements OnInit {
  @HostBinding('class') css = 'nested-form';

  @Input()
  group!: UntypedFormGroup;
  @Input()
  fillWidth?: HTMLElement;
  @Output()
  tagChanges = new EventEmitter<string>();
  @Input()
  showClear = false;
  @Output()
  clear = new EventEmitter<void>();

  @ViewChild('fill')
  fill?: ElementRef;

  @ViewChild('notifications')
  notifications!: TagsFormComponent;
  @ViewChild('readAccess')
  readAccess!: TagsFormComponent;
  @ViewChild('writeAccess')
  writeAccess!: TagsFormComponent;
  @ViewChild('tagReadAccess')
  tagReadAccess!: TagsFormComponent;
  @ViewChild('tagWriteAccess')
  tagWriteAccess!: TagsFormComponent;

  ngOnInit(): void {
  }

  get tag() {
    return this.group.get('tag') as UntypedFormControl;
  }

  setUser(user: User) {
    const notifications = this.group.get('notifications') as UntypedFormArray;
    const readAccess = this.group.get('readAccess') as UntypedFormArray;
    const writeAccess = this.group.get('writeAccess') as UntypedFormArray;
    const tagReadAccess = this.group.get('tagReadAccess') as UntypedFormArray;
    const tagWriteAccess = this.group.get('tagWriteAccess') as UntypedFormArray;
    const ns = (user.readAccess || []).filter(isMailbox);
    while (notifications.length < ns.length) this.notifications.addTag('placeholder')
    const ra = (user.readAccess || []).filter(t => !isMailbox(t));
    while (readAccess.length < ra.length) this.readAccess.addTag()
    while (writeAccess.length < (user.writeAccess?.length || 0)) this.writeAccess.addTag('placeholder');
    while (tagReadAccess.length < (user.tagReadAccess?.length || 0)) this.tagReadAccess.addTag('placeholder');
    while (tagWriteAccess.length < (user.tagWriteAccess?.length || 0)) this.tagWriteAccess.addTag('placeholder');
    this.group.patchValue({
      ...user,
      notifications: ns,
      readAccess: ra,
    });
  }

}

export function userForm(fb: UntypedFormBuilder, locked = false) {
  return fb.group({
    tag: [{value: '', disabled: locked}, [Validators.required, Validators.pattern(USER_REGEX)]],
    name: [''],
    role: [''],
    notifications: fb.array([]),
    readAccess: fb.array([]),
    writeAccess: fb.array([]),
    tagReadAccess: fb.array([]),
    tagWriteAccess: fb.array([]),
    pubKey: [''],
  });
}
