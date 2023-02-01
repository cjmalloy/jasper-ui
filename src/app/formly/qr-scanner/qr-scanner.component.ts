import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { Component, EventEmitter, HostBinding, Output, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { defer } from 'lodash-es';
import QrScanner from 'qr-scanner';

@Component({
  selector: 'app-qr-scanner',
  templateUrl: './qr-scanner.component.html',
  styleUrls: ['./qr-scanner.component.scss']
})
export class QrScannerComponent {
  @HostBinding('class') css = 'form-array';

  @ViewChild('video')
  video!: TemplateRef<HTMLVideoElement>;

  @Output()
  data = new EventEmitter<string>();

  scanner?: QrScanner;
  overlayRef?: OverlayRef;

  constructor(
    private viewContainerRef: ViewContainerRef,
    private overlay: Overlay,
  ) { }

  readQr(files?: FileList) {
    if (!files || !files.length) return;
    const file = files[0]!;
    QrScanner.scanImage(file).then(data => this.data.next(data));
  }

  scanQr() {
    if (this.scanner) {
      this.stopScanQr();
      return;
    }
    this.overlayRef = this.overlay.create({
      height: '100vh',
      width: '100vw',
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      hasBackdrop: true,
    });
    this.overlayRef.attach(new TemplatePortal(this.video, this.viewContainerRef));
    if (!this.overlayRef) return;
    this.scanner ||= new QrScanner(this.overlayRef.overlayElement.firstElementChild as HTMLVideoElement, ({ data }) => {
      if (data) this.data.next(data);
      this.stopScanQr();
    }, {
      preferredCamera: 'environment',
      highlightScanRegion: true,
    });
    this.scanner.start();
  }

  stopScanQr() {
    if (!this.scanner) return;
    this.scanner.stop();
    this.scanner.destroy();
    this.scanner = undefined;
    this.overlayRef?.detach();
    this.overlayRef?.dispose();
  }
}
