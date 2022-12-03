import { Component, HostBinding, Input, Renderer2 } from '@angular/core';
import { toDataURL, } from 'qrcode'

@Component({
  selector: 'app-qr',
  template: '',
  styleUrls: ['./qr.component.scss']
})
export class QrComponent {

  @HostBinding('style.background-image')
  bgImage = '';


  constructor(
    private renderer: Renderer2,
  ) { }

  @Input()
  set url(url: string)  {
      const canvasElement: HTMLCanvasElement = this.renderer.createElement("canvas");
      toDataURL(canvasElement, url, (error, url) => {
        this.bgImage = `url('${url}')`;
      });
  }

  get qrWidth() {
    return Math.min(256, window.innerWidth);
  }

}
