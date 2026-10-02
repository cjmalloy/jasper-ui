import { controlValue } from '../../util/form';
import { computed, Component, ElementRef, ChangeDetectionStrategy, input, output, signal, viewChild, afterNextRender } from '@angular/core';
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
  selector: 'app-user-form',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss'],
  host: { 'class': 'nested-form' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TagsFormComponent,
    FillWidthDirective,
    JsonComponent,
  ]
})
export class UserFormComponent {
  private readonly rootControlState = controlValue(() => this.group());

  private readonly controlState0 = controlValue(() => this.group().get('external'));
  private readonly controlState1 = controlValue(() => this.tag());


  readonly group = input.required<UntypedFormGroup>();
  readonly showPubKey = input(true);
  readonly fillWidth = input<HTMLElement>();
  readonly tagChanges = output<string>();
  readonly showClear = input(false);
  readonly clear = output<void>();
  readonly externalErrors = input<string[]>([]);

  readonly fill = viewChild<ElementRef>('fill');

  readonly notifications = viewChild.required<TagsFormComponent>('notifications');
  readonly readAccess = viewChild.required<TagsFormComponent>('readAccess');
  readonly writeAccess = viewChild.required<TagsFormComponent>('writeAccess');
  readonly tagReadAccess = viewChild.required<TagsFormComponent>('tagReadAccess');
  readonly tagWriteAccess = viewChild.required<TagsFormComponent>('tagWriteAccess');

  id = 'user-' + uuid();
  readonly editingExternal = signal<any>(false);

  private showedError = false;

  constructor(
    public store: Store,
  ) { }

  private readonly initialize = afterNextRender(() => {
    this.pubKey().disable();
  });

  readonly tag = computed(() => {
    this.rootControlState();
    return this.group().get('tag') as UntypedFormControl;
  });

  readonly pubKey = computed(() => {
    this.rootControlState();
    return this.group().get('pubKey') as UntypedFormControl;
  });

  readonly external = computed(() => {
    this.rootControlState();
    this.controlState0();
    return this.editingExternal() || this.group().get('external')?.value;
  });

  readonly showError = computed(() => {
    this.rootControlState();
    this.controlState1();
    return this.tag().touched && this.tag().errors;
  });

  validate(input: HTMLInputElement) {
    if (this.showError()) {
      if (this.tag().errors?.['required']) {
        input.setCustomValidity($localize`Tag must not be blank.`);
        input.reportValidity();
      }
      if (this.tag().errors?.['pattern']) {
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
    if (this.showError() && !this.showedError) {
      this.showedError = true;
      defer(() => this.validate(input));
    } else {
      this.showedError = false;
      this.tagChanges.emit(input.value)
    }
  }

  setUser(user: User) {
    this.notifications().setTags((user.readAccess || []).filter(isMailbox));
    this.readAccess().setTags((user.readAccess || []).filter(t => !isMailbox(t)));
    this.writeAccess().setTags([...user.writeAccess || []]);
    this.tagReadAccess().setTags([...user.tagReadAccess || []]);
    this.tagWriteAccess().setTags([...user.tagWriteAccess || []]);
    this.group().patchValue({
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
