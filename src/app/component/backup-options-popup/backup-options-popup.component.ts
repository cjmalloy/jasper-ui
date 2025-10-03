import { Component, EventEmitter, Output } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { BackupOptions } from '../../model/backup';

@Component({
  standalone: false,
  selector: 'app-backup-options-popup',
  templateUrl: './backup-options-popup.component.html',
  styleUrls: ['./backup-options-popup.component.scss'],
  host: {'class': 'backup-options-popup'}
})
export class BackupOptionsPopupComponent {

  @Output()
  confirmed = new EventEmitter<BackupOptions>();
  @Output()
  cancelled = new EventEmitter<void>();

  optionsForm: UntypedFormGroup;
  visible = false;

  constructor(
    private fb: UntypedFormBuilder,
  ) {
    this.optionsForm = fb.group({
      cache: [true],
      ref: [true],
      ext: [true],
      user: [true],
      plugin: [true],
      template: [true],
      newerThan: [''],
      olderThan: [''],
    });
  }

  show() {
    this.visible = true;
  }

  hide() {
    this.visible = false;
  }

  confirm() {
    const options: BackupOptions = {
      cache: this.optionsForm.value.cache,
      ref: this.optionsForm.value.ref,
      ext: this.optionsForm.value.ext,
      user: this.optionsForm.value.user,
      plugin: this.optionsForm.value.plugin,
      template: this.optionsForm.value.template,
      newerThan: this.optionsForm.value.newerThan || undefined,
      olderThan: this.optionsForm.value.olderThan || undefined,
    };
    this.confirmed.emit(options);
    this.hide();
  }

  cancel() {
    this.cancelled.emit();
    this.hide();
  }
}
