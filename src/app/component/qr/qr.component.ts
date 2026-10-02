import { Component, effect, input, ChangeDetectionStrategy, signal } from '@angular/core';
import { toDataURL, } from 'qrcode'

@Component({
  selector: 'app-qr',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./qr.component.scss'],
  host: {
    '[style.background-image]': 'bgImage()',
  },
})
export class QrComponent {

  readonly bgImage = signal('');
  readonly url = input<string | undefined>();

  constructor() {
    effect(() => {
      const url = this.url();
      if (!url) return;
      toDataURL(document.createElement('canvas'), url,
        (error, url) => this.bgImage.set(`url('${url}')`));
    });
  }

}
