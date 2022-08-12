import { Component, OnInit } from '@angular/core';
import { Store } from '../../store/store';

@Component({
  selector: 'app-settings-page',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsPage implements OnInit {

  constructor(
    public store: Store,
  ) { }

  ngOnInit(): void {
  }

}
