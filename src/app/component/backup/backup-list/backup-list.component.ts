import { Component, Input } from '@angular/core';

@Component({
  standalone: false,
  selector: 'app-backup-list',
  templateUrl: './backup-list.component.html',
  styleUrls: ['./backup-list.component.scss']
})
export class BackupListComponent {

  @Input()
  list?: string[];
  @Input()
  origin = '';

}
