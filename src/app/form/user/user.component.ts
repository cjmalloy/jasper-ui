import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import {
  ReactiveFormsModule,
  UntypedFormArray,
  UntypedFormBuilder,
  UntypedFormControl,
  UntypedFormGroup,
  Validators
} from '@angular/forms';
import { defer } from 'lodash-es';
import { v4 as uuid } from 'uuid';
import { FillWidthDirective } from '../../directive/fill-width.directive';
import { User } from '../../model/user';
import { isMailbox } from '../../mods/mailbox';
import { Store } from '../../store/store';
import { USER_REGEX } from '../../util/format';
import { JsonComponent } from '../json/json.component';
import { TagsFormComponent } from '../tags/tags.component';

@Component({
  selector: 'app-user-form',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss'],
  host: { 'class': 'nested-form' },
  imports: [
    ReactiveFormsModule,
    TagsFormComponent,
    FillWidthDirective,
    JsonComponent,
  ]
})
export class UserFormComponent implements OnInit {

  @Input()
  group!: UntypedFormGroup;
  @Input()
  showPubKey = true;
  @Input()
  fillWidth?: HTMLElement;
  @Output()
  tagChanges = new EventEmitter<string>();
  @Input()
  showClear = false;
  @Output()
  clear = new EventEmitter<void>();
  @Input()
  externalErrors: string[] = [];

  @ViewChild('fill')
  fill?: ElementRef;

  id = 'user-' + uuid();
  editingExternal = false;

  private showedError = false;

  constructor(
    public store: Store,
    private fb: UntypedFormBuilder,
  ) { }

  ngOnInit(): void {
    this.pubKey.disable();
  }

  get tag() {
    return this.group.get('tag') as UntypedFormControl;
  }

  get pubKey() {
    return this.group.get('pubKey') as UntypedFormControl;
  }

  get notifications() {
    return this.group.get('notifications') as UntypedFormArray;
  }

  get readAccess() {
    return this.group.get('readAccess') as UntypedFormArray;
  }

  get writeAccess() {
    return this.group.get('writeAccess') as UntypedFormArray;
  }

  get tagReadAccess() {
    return this.group.get('tagReadAccess') as UntypedFormArray;
  }

  get tagWriteAccess() {
    return this.group.get('tagWriteAccess') as UntypedFormArray;
  }

  get external() {
    return this.editingExternal ||= this.group.get('external')?.value;
  }

  get showError() {
    return this.tag.touched && this.tag.errors;
  }

  validate(input: HTMLInputElement) {
    if (this.showError) {
      if (this.tag.errors?.['required']) {
        input.setCustomValidity($localize`Tag must not be blank.`);
        input.reportValidity();
      }
      if (this.tag.errors?.['pattern']) {
        input.setCustomValidity($localize`
          User tags must start with the "+user/" or "_user/" prefix.
          Tags must be lower case letters and forward slashes. Must not start with a slash or contain two forward slashes in a row. Private
          tags start with an underscore.
          (i.e. "+user/alice", "_user/bob", or "+user/department/charlie")`);
        input.reportValidity();
      }
    }
  }

  blur(input: HTMLInputElement) {
    if (this.showError && !this.showedError) {
      this.showedError = true;
      defer(() => this.validate(input));
    } else {
      this.showedError = false;
      this.tagChanges.next(input.value)
    }
  }

  /**
   * Set the user value through the form group.
   * All form arrays are manipulated directly.
   */
  setUser(user: User) {
    this.setFormArray(this.notifications, (user.readAccess || []).filter(isMailbox));
    this.setFormArray(this.readAccess, (user.readAccess || []).filter(t => !isMailbox(t)));
    this.setFormArray(this.writeAccess, [...user.writeAccess || []]);
    this.setFormArray(this.tagReadAccess, [...user.tagReadAccess || []]);
    this.setFormArray(this.tagWriteAccess, [...user.tagWriteAccess || []]);
    this.group.patchValue({
      ...user,
      external: user.external ? JSON.stringify(user.external, null, 2) : undefined,
    });
  }

  /**
   * Set form array values through the form group.
   */
  private setFormArray(formArray: UntypedFormArray, values: string[]) {
    while (formArray.length > values.length) formArray.removeAt(formArray.length - 1, { emitEvent: false });
    while (formArray.length < values.length) formArray.push(this.fb.control('', TagsFormComponent.validators), { emitEvent: false });
    formArray.setValue(values);
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
    pubKey: ['', { disabled: true }],
    authorizedKeys: [''],
    external: [],
  });
}
