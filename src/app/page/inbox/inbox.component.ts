import { Component, OnInit } from '@angular/core';
import { AdminService } from '../../service/admin.service';

@Component({
  selector: 'app-inbox-page',
  templateUrl: './inbox.component.html',
  styleUrls: ['./inbox.component.scss'],
})
export class InboxPage implements OnInit {

  constructor(
    public admin: AdminService,
  ) { }

  ngOnInit(): void {
  }

}
