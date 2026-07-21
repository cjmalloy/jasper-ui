import { Component, HostBinding, Input, ChangeDetectionStrategy } from '@angular/core';
import { toDataURL, } from 'qrcode'

@Component({
  selector: 'app-qr',
  template: '',
  changeDetection: ChangeDetectionStrategy.Eager,
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
