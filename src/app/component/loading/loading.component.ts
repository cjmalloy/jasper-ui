import { Component, HostBinding, Input } from '@angular/core';

@Component({
  selector: 'app-loading',
  templateUrl: './loading.component.html',
  styleUrls: ['./loading.component.scss'],
})
export class LoadingComponent {

  @Input()
  @HostBinding('class.inline')
  inline = false;

}
