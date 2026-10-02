import { Component, HostBinding, Input, ChangeDetectionStrategy, signal } from '@angular/core';
import { toDataURL, } from 'qrcode'

@Component({
  selector: 'app-qr',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./qr.component.scss']
})
export class QrComponent {

  @HostBinding('style.background-image')
  get bgImage() {
    return this.bgImageSignal();
  }
  private readonly bgImageSignal = signal('');

  @Input()
  set url(url: string | undefined)  {
    if (!url) return;
    toDataURL(document.createElement('canvas'), url,
      (error, url) => this.bgImageSignal.set(`url('${url}')`));
  }

}
