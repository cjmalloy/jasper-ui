import { Component, HostBinding } from '@angular/core';
import { ConfigService } from './service/config.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {

  @HostBinding('class.electron') electron = this.config.electron;

  constructor(
    public config: ConfigService,
  ) { }

}
