import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Input,
  input,
  OnInit,
  output,
  viewChild
} from '@angular/core';
import {
  ReactiveFormsModule,
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
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  store = inject(Store);


  @Input()
  group!: UntypedFormGroup;
  readonly showPubKey = input(true);
  readonly fillWidth = input<HTMLElement>();
  readonly tagChanges = output<string>();
  readonly showClear = input(false);
  readonly clear = output<void>();
  @Input()
  externalErrors: string[] = [];

  readonly fill = viewChild<ElementRef>('fill');

  readonly notifications = viewChild.required<TagsFormComponent>('notifications');
  readonly readAccess = viewChild.required<TagsFormComponent>('readAccess');
  readonly writeAccess = viewChild.required<TagsFormComponent>('writeAccess');
  readonly tagReadAccess = viewChild.required<TagsFormComponent>('tagReadAccess');
  readonly tagWriteAccess = viewChild.required<TagsFormComponent>('tagWriteAccess');

  id = 'user-' + uuid();
  editingExternal = false;

  private showedError = false;

  ngOnInit(): void {
    this.pubKey.disable();
  }

  get tag() {
    return this.group.get('tag') as UntypedFormControl;
  }

  get pubKey() {
    return this.group.get('pubKey') as UntypedFormControl;
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
      this.tagChanges.emit(input.value);
    }
  }

  setUser(user: User) {
    this.notifications().setTags((user.readAccess || []).filter(isMailbox));
    this.readAccess().setTags((user.readAccess || []).filter(t => !isMailbox(t)));
    this.writeAccess().setTags([...user.writeAccess || []]);
    this.tagReadAccess().setTags([...user.tagReadAccess || []]);
    this.tagWriteAccess().setTags([...user.tagWriteAccess || []]);
    this.group.patchValue({
      ...user,
      external: user.external ? JSON.stringify(user.external, null, 2) : undefined,
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
    pubKey: ['', { disabled: true }],
    authorizedKeys: [''],
    external: [],
  });
}
