import { Component, HostBinding, Input } from '@angular/core';

@Component({
  standalone: false,
  selector: 'app-loading',
  templateUrl: './loading.component.html',
  styleUrls: ['./loading.component.scss'],
})
export class LoadingComponent {
  @HostBinding('class') css = 'loading-dots';

  @Input()
  @HostBinding('class.inline')
  inline = false;

  @Input()
  @HostBinding('class.batch')
  batch = false;

}
