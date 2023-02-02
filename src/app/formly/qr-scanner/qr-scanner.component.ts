import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { Component, EventEmitter, HostBinding, Output, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import QrScanner from 'qr-scanner';

export let hasCamera = false;
QrScanner.hasCamera().then(value => hasCamera = value);
export let cameras: QrScanner.Camera[] = [];
QrScanner.listCameras().then(value => cameras = value);

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
  hasCamera = hasCamera;
  hasFlash = false;

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
    this.scanner ||= new QrScanner(this.overlayRef.overlayElement.firstElementChild as HTMLVideoElement, ({ data }) => {
      if (data) this.data.next(data);
      this.stopScanQr();
    }, {
      preferredCamera: 'environment',
      highlightScanRegion: true,
    });
    this.scanner.start()
      .then(() => this.scanner?.hasFlash())
      .then(value => this.hasFlash = !!value);
  }

  stopScanQr() {
    if (!this.scanner) return;
    this.scanner.stop();
    this.scanner.destroy();
    this.scanner = undefined;
    this.overlayRef?.detach();
    this.overlayRef?.dispose();
  }

  get hasMultipleCameras() {
    return cameras.length > 1;
  }

  get camera() {
    return localStorage.getItem('cameraId')!;
  }

  set camera(id: string | undefined) {
    localStorage.setItem('cameraId', id!);
  }

  nextCamera() {
    QrScanner.listCameras()
      .then(cameras => {
        if (!cameras.length) return;
        const cameraId = this.camera;
        for (let i = 0; i < cameras.length; i++) {
          if (!cameraId) return this.camera = cameras[i].id;
          if (cameraId === cameras[i].id) return this.camera = cameras[(i + 1) % cameras.length].id;
        }
        return this.camera = cameras[0].id;
      });
  }
}
