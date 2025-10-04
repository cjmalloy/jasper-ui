import { 
  ChangeDetectionStrategy,
  Component, HostBinding, Input } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
  selector: 'app-loading',
  templateUrl: './loading.component.html',
  styleUrls: ['./loading.component.scss'],
  host: {'class': 'loading-dots'}
})
export class LoadingComponent {

  @Input()
  @HostBinding('class.inline')
  inline = false;

  @Input()
  @HostBinding('class.batch')
  batch = false;

}
