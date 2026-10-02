import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { from, map, of, switchMap } from 'rxjs';
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

  readonly url = input<string | undefined>();
  readonly bgImage = toSignal(toObservable(this.url).pipe(
    switchMap(url => url ? from(toDataURL(document.createElement('canvas'), url)).pipe(
      map(data => `url('${data}')`),
    ) : of('')),
  ), { initialValue: '' });

}
