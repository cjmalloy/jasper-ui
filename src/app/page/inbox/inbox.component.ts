import { Component, HostBinding, OnInit } from '@angular/core';
import { AdminService } from '../../service/admin.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-inbox-page',
  templateUrl: './inbox.component.html',
  styleUrls: ['./inbox.component.scss'],
})
export class InboxPage implements OnInit {
  @HostBinding('class') css = 'inbox';

  constructor(
    public admin: AdminService,
    public store: Store,
  ) { }

  ngOnInit(): void {
  }

}
