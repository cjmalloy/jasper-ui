import { Component, HostBinding, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-loading',
  templateUrl: './loading.component.html',
  styleUrls: ['./loading.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  host: { 'class': 'loading-dots' }
})
export class LoadingComponent {

  @Input()
  @HostBinding('class.inline')
  inline = false;

  @Input()
  @HostBinding('class.batch')
  batch = false;

}
