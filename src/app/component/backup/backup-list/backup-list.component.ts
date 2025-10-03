import { Component, EventEmitter, Input, Output } from '@angular/core';
import { BackupRef } from '../../../service/api/backup.service';

@Component({
  standalone: false,
  selector: 'app-backup-list',
  templateUrl: './backup-list.component.html',
  styleUrls: ['./backup-list.component.scss']
})
export class BackupListComponent {

  @Input()
  list?: BackupRef[];
  @Input()
  origin = '';

  @Output()
  restoreRequested = new EventEmitter<BackupRef>();

  onRestoreRequested(backup: BackupRef) {
    this.restoreRequested.emit(backup);
  }

}
