import { Component, input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-loading',
  templateUrl: './loading.component.html',
  styleUrls: ['./loading.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'loading-dots',
    '[class.inline]': 'inline()',
    '[class.batch]': 'batch()',
  }
})
export class LoadingComponent {

  readonly inline = input(false);

  readonly batch = input(false);

}
