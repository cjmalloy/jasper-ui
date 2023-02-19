import { Directive, ElementRef, Input } from '@angular/core';
import { Dim, ImageDimService } from '../service/image-dim.service';
import { mobileWidth } from './fill-width.directive';

@Directive({
  selector: '[appImageDim]'
})
export class ImageDimDirective {
  @Input('defaultWidth')
  width?: string;
  @Input('defaultHeight')
  height?: string;

  constructor(
    private el: ElementRef,
    private ids: ImageDimService,
  ) {
    if (window.innerWidth <= mobileWidth) {
      this.el.nativeElement.style.width = this.width;
      this.el.nativeElement.style.height = this.height;
      this.el.nativeElement.style.backgroundSize = 'cover';
    } else {
      this.el.nativeElement.style.height = '100vh';
      this.el.nativeElement.style.width = '80vw';
    }
  }

  @Input('appImageDim')
  set url(value: string) {
    this.ids.getImageDim(value)
      .then((d: Dim) => {
        if (window.innerWidth <= mobileWidth) {
          this.el.nativeElement.style.width = '100vw';
          this.el.nativeElement.style.height = (window.innerWidth * d.height / d.width) + 'px';
          this.el.nativeElement.style.backgroundSize = 'contain';
        } else {
          this.el.nativeElement.style.width = d.width + 'px';
          this.el.nativeElement.style.height = d.height + 'px';
        }
    })
  }
}
