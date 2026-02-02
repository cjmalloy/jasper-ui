import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';
import { toDataURL, } from 'qrcode'

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-qr',
  template: '',
  styleUrls: ['./qr.component.scss']
})
export class QrComponent {

  @HostBinding('style.background-image')
  bgImage = '';

  @Input()
  set url(url: string | undefined)  {
    if (!url) return;
    toDataURL(document.createElement('canvas'), url,
      (error, url) => this.bgImage = `url('${url}')`);
  }

}
