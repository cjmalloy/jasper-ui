import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-backup-list',
  templateUrl: './backup-list.component.html',
  styleUrls: ['./backup-list.component.scss']
})
export class BackupListComponent implements OnInit {

  @Input()
  list?: string[];
  @Input()
  origin = '';

  constructor() { }

  ngOnInit(): void {
  }

}
