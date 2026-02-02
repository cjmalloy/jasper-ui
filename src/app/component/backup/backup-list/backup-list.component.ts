import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { BackupRef } from '../../../service/api/backup.service';
import { LoadingComponent } from '../../loading/loading.component';
import { BackupComponent } from '../backup.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-backup-list',
  templateUrl: './backup-list.component.html',
  styleUrls: ['./backup-list.component.scss'],
  imports: [LoadingComponent, BackupComponent]
})
export class BackupListComponent {

  @Input()
  list?: BackupRef[];
  @Input()
  origin = '';

}
