import { Component, input } from '@angular/core';

@Component({
  selector: 'app-loading',
  templateUrl: './loading.component.html',
  styleUrls: ['./loading.component.scss'],
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
