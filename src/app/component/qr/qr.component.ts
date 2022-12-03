import { Component, HostBinding, Input } from '@angular/core';
import { toDataURL, } from 'qrcode'

@Component({
  selector: 'app-qr',
  template: '',
  styleUrls: ['./qr.component.scss']
})
export class QrComponent {

  @HostBinding('style.background-image')
  bgImage = '';

  @Input()
  set url(url: string)  {
      toDataURL(document.createElement('canvas'), url,
        (error, url) => this.bgImage = `url('${url}')`);
  }

  get qrWidth() {
    return Math.min(256, window.innerWidth);
  }

}
